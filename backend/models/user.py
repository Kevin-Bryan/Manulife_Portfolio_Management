from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    DateTime,
    func,
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from auth.database import Base


# class User(Base):
#     __tablename__ = "users"

#     id = Column(Integer, primary_key=True, index=True)
#     username = Column(String, unique=True, nullable=False)
#     hashed_password = Column(String, nullable=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=False), server_default=func.now())

    holdings = relationship("Holding", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    asset_type = Column(String(50), nullable=False)
    sector = Column(String(100), nullable=True)
    current_price = Column(Numeric(18, 4), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    holdings = relationship("Holding", back_populates="asset", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="asset", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('stock', 'bond', 'mutual_fund')",
            name="check_asset_type"
        ),
        CheckConstraint("current_price >= 0", name="check_current_price_non_negative"),
    )

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False, default=0)
    average_purchase_price = Column(Numeric(18, 4), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="holdings")
    asset = relationship("Asset", back_populates="holdings")

    __table_args__ = (
        UniqueConstraint("user_id", "asset_id", name="uq_user_asset"),
        CheckConstraint("quantity >= 0", name="check_quantity_non_negative"),
        CheckConstraint("average_purchase_price >= 0", name="check_avg_purchase_price_non_negative"),
    )

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(10), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    price = Column(Numeric(18, 4), nullable=False)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")
    asset = relationship("Asset", back_populates="transactions")

    __table_args__ = (
        CheckConstraint("transaction_type IN ('buy', 'sell')", name="check_transaction_type"),
        CheckConstraint("quantity > 0", name="check_transaction_quantity_positive"),
        CheckConstraint("price > 0", name="check_transaction_price_positive"),
    )