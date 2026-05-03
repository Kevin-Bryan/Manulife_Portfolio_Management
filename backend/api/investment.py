import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from auth.database import get_db
from models.user import Asset, Holding, Transaction
from api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateInvestmentRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    quantity: float = Field(..., gt=0)
    average_purchase_price: float = Field(..., ge=0)


class UpdateInvestmentRequest(BaseModel):
    quantity: float = Field(..., gt=0)
    average_purchase_price: float = Field(..., ge=0)



@router.post("/portfolio/investments", status_code=status.HTTP_201_CREATED)
def create_investment(
    payload: CreateInvestmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logger.info(
        "POST /portfolio/investments called by user_id=%s with payload=%s",
        current_user.id,
        payload.dict(),
    )

    symbol = payload.symbol.strip().upper()

    asset = db.query(Asset).filter(Asset.symbol == symbol).first()
    if not asset:
        logger.warning("Asset not found for symbol=%s", symbol)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with symbol '{symbol}' not found.",
        )

    existing_holding = (
        db.query(Holding)
        .filter(Holding.user_id == current_user.id, Holding.asset_id == asset.id)
        .first()
    )
    if existing_holding:
        logger.warning(
            "Holding already exists for user_id=%s asset_id=%s",
            current_user.id,
            asset.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have this investment in your portfolio.",
        )

    holding = Holding(
        user_id=current_user.id,
        asset_id=asset.id,
        quantity=payload.quantity,
        average_purchase_price=payload.average_purchase_price,
    )

    db.add(holding)
    db.commit()
    db.refresh(holding)

    holding = (
        db.query(Holding)
        .options(joinedload(Holding.asset))
        .filter(Holding.id == holding.id)
        .first()
    )

    current_price = float(holding.asset.current_price)
    quantity = float(holding.quantity)
    avg_price = float(holding.average_purchase_price)

    response = {
        "id": holding.id,
        "asset_id": holding.asset.id,
        "symbol": holding.asset.symbol,
        "name": holding.asset.name,
        "asset_type": holding.asset.asset_type,
        "sector": holding.asset.sector,
        "quantity": quantity,
        "average_purchase_price": avg_price,
        "current_price": current_price,
        "market_value": quantity * current_price,
        "cost_basis": quantity * avg_price,
        "gain_loss": (quantity * current_price) - (quantity * avg_price),
    }

    logger.info("Created holding for user_id=%s: %s", current_user.id, response)
    return response


@router.put("/portfolio/investments/{holding_id}")
def update_investment(
    holding_id: int,
    payload: UpdateInvestmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logger.info(
        "PUT /portfolio/investments/%s called by user_id=%s with payload=%s",
        holding_id,
        current_user.id,
        payload.dict(),
    )

    holding = (
        db.query(Holding)
        .options(joinedload(Holding.asset))
        .filter(Holding.id == holding_id, Holding.user_id == current_user.id)
        .first()
    )

    if not holding:
        logger.warning(
            "Holding not found for holding_id=%s user_id=%s",
            holding_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investment not found.",
        )

    holding.quantity = payload.quantity
    holding.average_purchase_price = payload.average_purchase_price

    db.commit()
    db.refresh(holding)

    holding = (
        db.query(Holding)
        .options(joinedload(Holding.asset))
        .filter(Holding.id == holding.id)
        .first()
    )

    current_price = float(holding.asset.current_price)
    quantity = float(holding.quantity)
    avg_price = float(holding.average_purchase_price)

    response = {
        "id": holding.id,
        "asset_id": holding.asset.id,
        "symbol": holding.asset.symbol,
        "name": holding.asset.name,
        "asset_type": holding.asset.asset_type,
        "sector": holding.asset.sector,
        "quantity": quantity,
        "average_purchase_price": avg_price,
        "current_price": current_price,
        "market_value": quantity * current_price,
        "cost_basis": quantity * avg_price,
        "gain_loss": (quantity * current_price) - (quantity * avg_price),
    }

    logger.info("Updated holding for user_id=%s: %s", current_user.id, response)
    return response