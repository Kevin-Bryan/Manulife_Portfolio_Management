import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from auth.database import get_db
from models.user import Asset, Holding, Transaction
from api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/portfolio/assets")
def get_assets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    logger.info("GET /portfolio/assets called by user_id=%s", current_user.id)

    assets = db.query(Asset).order_by(Asset.symbol.asc()).all()

    result = [
        {
            "id": asset.id,
            "symbol": asset.symbol,
            "name": asset.name,
            "asset_type": asset.asset_type,
            "current_price": float(asset.current_price),
        }
        for asset in assets
    ]

    # logger.info("Assets response for user_id=%s: %s", current_user.id, result)
    return result


@router.get("/portfolio/holdings")
def get_holdings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    logger.info("GET /portfolio/holdings called by user_id=%s", current_user.id)

    total_holdings = db.query(Holding).count()
    logger.info("Total holdings in DB: %s", total_holdings)

    holdings = (
        db.query(Holding)
        .options(joinedload(Holding.asset))
        .filter(Holding.user_id == current_user.id)
        .all()
    )

    # logger.info("Found %s holdings for user_id=%s", len(holdings), current_user.id)
    # logger.info("Holdings raw rows: %s", holdings)

    result = []
    for holding in holdings:
        current_price = float(holding.asset.current_price)
        quantity = float(holding.quantity)
        avg_price = float(holding.average_purchase_price)

        market_value = quantity * current_price
        cost_basis = quantity * avg_price
        gain_loss = market_value - cost_basis

        result.append({
            "id": holding.id,
            "asset_id": holding.asset.id,
            "symbol": holding.asset.symbol,
            "name": holding.asset.name,
            "asset_type": holding.asset.asset_type,
            "sector": holding.asset.sector,
            "quantity": quantity,
            "average_purchase_price": avg_price,
            "current_price": current_price,
            "market_value": market_value,
            "cost_basis": cost_basis,
            "gain_loss": gain_loss,
        })

    # logger.info("Holdings response for user_id=%s: %s", current_user.id, result)
    return result


@router.get("/portfolio/transactions")
def get_transactions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    logger.info("GET /portfolio/transactions called by user_id=%s", current_user.id)

    total_transactions = db.query(Transaction).count()
    logger.info("Total transactions in DB: %s", total_transactions)

    transactions = (
        db.query(Transaction)
        .options(joinedload(Transaction.asset))
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date.desc())
        .all()
    )

    # logger.info("Found %s transactions for user_id=%s", len(transactions), current_user.id)
    # logger.info("Transactions raw rows: %s", transactions)

    result = [
        {
            "id": tx.id,
            "symbol": tx.asset.symbol,
            "name": tx.asset.name,
            "transaction_type": tx.transaction_type,
            "quantity": float(tx.quantity),
            "price": float(tx.price),
            "transaction_date": tx.transaction_date,
        }
        for tx in transactions
    ]

    # logger.info("Transactions response for user_id=%s: %s", current_user.id, result)
    return result