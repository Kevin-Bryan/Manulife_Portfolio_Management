import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from auth.database import SessionLocal
from auth.utils import decode_token
from models.user import Asset, Holding, Transaction
from websocket_manager import manager

router = APIRouter(tags=["websocket"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fetch_holdings(user_id: int, db: Session) -> list[dict]:
    rows = (
        db.query(Holding)
        .options(joinedload(Holding.asset))
        .filter(Holding.user_id == user_id)
        .all()
    )
    result = []
    for h in rows:
        qty = float(h.quantity)
        avg = float(h.average_purchase_price)
        cur = float(h.asset.current_price)
        mv = qty * cur
        cb = qty * avg
        result.append({
            "id": h.id,
            "asset_id": h.asset.id,
            "symbol": h.asset.symbol,
            "name": h.asset.name,
            "asset_type": h.asset.asset_type,
            "sector": h.asset.sector,
            "quantity": qty,
            "average_purchase_price": avg,
            "current_price": cur,
            "market_value": mv,
            "cost_basis": cb,
            "gain_loss": mv - cb,
        })
    return result


# ─── Action handlers — return an error string, or None on success ─────────────

def _add_transaction(user_id: int, p: dict, db: Session) -> str | None:
    asset_id = p.get("asset_id")
    tx_type = p.get("transaction_type")
    qty = p.get("quantity")
    price = p.get("price")

    if not all([asset_id, tx_type, qty is not None, price is not None]):
        return "Missing required fields"
    if tx_type not in ("buy", "sell"):
        return "transaction_type must be 'buy' or 'sell'"
    if qty <= 0 or price <= 0:
        return "quantity and price must be positive"

    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        return "Asset not found"

    db.add(Transaction(
        user_id=user_id,
        asset_id=asset_id,
        transaction_type=tx_type,
        quantity=qty,
        price=price,
        transaction_date=datetime.now(timezone.utc),
    ))

    holding = db.query(Holding).filter(
        Holding.user_id == user_id,
        Holding.asset_id == asset_id,
    ).first()

    if tx_type == "buy":
        if holding:
            old_qty = float(holding.quantity)
            old_avg = float(holding.average_purchase_price)
            new_qty = old_qty + qty
            holding.quantity = new_qty
            holding.average_purchase_price = (old_qty * old_avg + qty * price) / new_qty
        else:
            db.add(Holding(
                user_id=user_id,
                asset_id=asset_id,
                quantity=qty,
                average_purchase_price=price,
            ))
    else:
        if not holding or float(holding.quantity) < qty:
            return "Insufficient quantity to sell"
        holding.quantity = float(holding.quantity) - qty

    db.commit()
    return None


def _edit_holding(user_id: int, p: dict, db: Session) -> str | None:
    hid = p.get("holding_id")
    qty = p.get("quantity")
    avg = p.get("average_purchase_price")

    if any(v is None for v in [hid, qty, avg]):
        return "Missing required fields"

    holding = db.query(Holding).filter(
        Holding.id == hid,
        Holding.user_id == user_id,
    ).first()

    if not holding:
        return "Holding not found"

    holding.quantity = qty
    holding.average_purchase_price = avg
    db.commit()
    return None


def _delete_holding(user_id: int, p: dict, db: Session) -> str | None:
    hid = p.get("holding_id")
    if hid is None:
        return "Missing holding_id"

    holding = db.query(Holding).filter(
        Holding.id == hid,
        Holding.user_id == user_id,
    ).first()

    if not holding:
        return "Holding not found"

    db.delete(holding)
    db.commit()
    return None


_HANDLERS = {
    "add_transaction": _add_transaction,
    "edit_holding": _edit_holding,
    "delete_holding": _delete_holding,
}


# ─── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_main(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        exp = payload.get("exp")

        if user_id is None or exp is None:
            await websocket.close(code=1008, reason="Invalid token payload")
            return

        user_id = int(user_id)
        now_ts = datetime.now(timezone.utc).timestamp()
        ttl = exp - now_ts

        if ttl <= 0:
            await websocket.close(code=1008, reason="Token expired")
            return

    except JWTError:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    await manager.connect(user_id, websocket)

    async def close_on_expiry():
        await asyncio.sleep(ttl)
        try:
            await websocket.close(code=4001, reason="Session expired")
        except Exception:
            pass

    expiry_task = asyncio.create_task(close_on_expiry())

    try:
        while True:
            raw = await websocket.receive_text()

            # ── Plain-text messages (ping/pong) ────────────────────────────
            if raw == "ping":
                await websocket.send_text("pong")
                continue

            # ── JSON action messages ───────────────────────────────────────
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal_message(user_id, {
                    "type": "error",
                    "payload": {"message": "Invalid JSON"},
                })
                continue

            msg_type = data.get("type")
            handler = _HANDLERS.get(msg_type)

            if not handler:
                await manager.send_personal_message(user_id, {
                    "type": "error",
                    "payload": {"message": f"Unknown action: {msg_type}"},
                })
                continue

            db = SessionLocal()
            try:
                error_msg = handler(user_id, data.get("payload", {}), db)
                if error_msg:
                    await manager.send_personal_message(user_id, {
                        "type": "error",
                        "payload": {"message": error_msg},
                    })
                else:
                    # Push fresh holdings back to this client immediately
                    await manager.send_personal_message(user_id, {
                        "type": "holdings_updated",
                        "payload": _fetch_holdings(user_id, db),
                    })
            except Exception:
                db.rollback()
                await manager.send_personal_message(user_id, {
                    "type": "error",
                    "payload": {"message": "Internal server error"},
                })
            finally:
                db.close()

    except WebSocketDisconnect:
        pass
    finally:
        expiry_task.cancel()
        manager.disconnect(user_id, websocket)