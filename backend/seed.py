from decimal import Decimal
from datetime import datetime, timedelta

from auth.database import SessionLocal
from models.user import User, Asset, Holding, Transaction
from auth.utils import hash_password


def seed():
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.username == "demo").first()
        if not user:
            user = User(
                username="demo",
                hashed_password=hash_password("password123")
            )
            db.add(user)
            db.flush()
            print("Created demo user.")
        else:
            print("Demo user already exists.")

        asset_data = [
            {"symbol": "AAPL", "name": "Apple Inc.", "asset_type": "stock", "sector": "Technology", "current_price": Decimal("192.50")},
            {"symbol": "MSFT", "name": "Microsoft Corp.", "asset_type": "stock", "sector": "Technology", "current_price": Decimal("415.20")},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "asset_type": "stock", "sector": "Communication Services", "current_price": Decimal("168.40")},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "asset_type": "stock", "sector": "Consumer Discretionary", "current_price": Decimal("182.75")},
            {"symbol": "TSLA", "name": "Tesla Inc.", "asset_type": "stock", "sector": "Automotive", "current_price": Decimal("171.30")},
            {"symbol": "NVDA", "name": "NVIDIA Corp.", "asset_type": "stock", "sector": "Technology", "current_price": Decimal("875.60")},
            {"symbol": "META", "name": "Meta Platforms Inc.", "asset_type": "stock", "sector": "Communication Services", "current_price": Decimal("502.40")},
            {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "asset_type": "stock", "sector": "Financials", "current_price": Decimal("198.15")},
            {"symbol": "BAC", "name": "Bank of America Corp.", "asset_type": "stock", "sector": "Financials", "current_price": Decimal("37.85")},
            {"symbol": "JNJ", "name": "Johnson & Johnson", "asset_type": "stock", "sector": "Health Care", "current_price": Decimal("151.80")},
            {"symbol": "PFE", "name": "Pfizer Inc.", "asset_type": "stock", "sector": "Health Care", "current_price": Decimal("27.95")},
            {"symbol": "WMT", "name": "Walmart Inc.", "asset_type": "stock", "sector": "Consumer Staples", "current_price": Decimal("68.40")},
            {"symbol": "KO", "name": "Coca-Cola Co.", "asset_type": "stock", "sector": "Consumer Staples", "current_price": Decimal("62.15")},
            {"symbol": "PG", "name": "Procter & Gamble Co.", "asset_type": "stock", "sector": "Consumer Staples", "current_price": Decimal("164.20")},
            {"symbol": "DIS", "name": "Walt Disney Co.", "asset_type": "stock", "sector": "Communication Services", "current_price": Decimal("113.45")},
            {"symbol": "NFLX", "name": "Netflix Inc.", "asset_type": "stock", "sector": "Communication Services", "current_price": Decimal("628.30")},
            {"symbol": "XOM", "name": "Exxon Mobil Corp.", "asset_type": "stock", "sector": "Energy", "current_price": Decimal("116.90")},
            {"symbol": "CVX", "name": "Chevron Corp.", "asset_type": "stock", "sector": "Energy", "current_price": Decimal("156.70")},
            {"symbol": "V", "name": "Visa Inc.", "asset_type": "stock", "sector": "Financials", "current_price": Decimal("273.60")},
            {"symbol": "HD", "name": "Home Depot Inc.", "asset_type": "stock", "sector": "Consumer Discretionary", "current_price": Decimal("338.25")},

            {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("72.45")},
            {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("98.20")},
            {"symbol": "TLT", "name": "iShares 20+ Year Treasury Bond ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("91.60")},
            {"symbol": "IEF", "name": "iShares 7-10 Year Treasury Bond ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("94.35")},
            {"symbol": "SHY", "name": "iShares 1-3 Year Treasury Bond ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("81.25")},
            {"symbol": "LQD", "name": "iShares iBoxx $ Investment Grade Corporate Bond ETF", "asset_type": "bond", "sector": "Fixed Income", "current_price": Decimal("107.40")},

            {"symbol": "VFIAX", "name": "Vanguard 500 Index Fund", "asset_type": "mutual_fund", "sector": "Blend", "current_price": Decimal("489.30")},
            {"symbol": "FXAIX", "name": "Fidelity 500 Index Fund", "asset_type": "mutual_fund", "sector": "Blend", "current_price": Decimal("187.40")},
            {"symbol": "SWPPX", "name": "Schwab S&P 500 Index Fund", "asset_type": "mutual_fund", "sector": "Blend", "current_price": Decimal("89.50")},
            {"symbol": "VTSAX", "name": "Vanguard Total Stock Market Index Fund", "asset_type": "mutual_fund", "sector": "Blend", "current_price": Decimal("128.75")},
            {"symbol": "VIGAX", "name": "Vanguard Growth Index Fund Admiral Shares", "asset_type": "mutual_fund", "sector": "Large Growth", "current_price": Decimal("184.20")},
            {"symbol": "VWELX", "name": "Vanguard Wellington Fund", "asset_type": "mutual_fund", "sector": "Moderate Allocation", "current_price": Decimal("43.10")},
        ]
        assets_by_symbol = {}

        for item in asset_data:
            asset = db.query(Asset).filter(Asset.symbol == item["symbol"]).first()
            if not asset:
                asset = Asset(**item)
                db.add(asset)
                db.flush()
                print(f"Inserted asset {item['symbol']}")
            else:
                # Optional: refresh existing asset price/metadata
                asset.name = item["name"]
                asset.asset_type = item["asset_type"]
                asset.sector = item["sector"]
                asset.current_price = item["current_price"]
            assets_by_symbol[item["symbol"]] = asset

        db.flush()

        # Clear existing demo user's holdings and transactions
        db.query(Transaction).filter(Transaction.user_id == user.id).delete()
        db.query(Holding).filter(Holding.user_id == user.id).delete()
        db.flush()

        # Holdings for demo user
        holdings = [
            Holding(user_id=user.id, asset_id=assets_by_symbol["AAPL"].id, quantity=Decimal("15"), average_purchase_price=Decimal("176.25")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["GOOGL"].id, quantity=Decimal("12"), average_purchase_price=Decimal("151.80")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["NVDA"].id, quantity=Decimal("4"), average_purchase_price=Decimal("790.00")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["BND"].id, quantity=Decimal("30"), average_purchase_price=Decimal("70.20")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["AGG"].id, quantity=Decimal("20"), average_purchase_price=Decimal("96.70")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["VFIAX"].id, quantity=Decimal("10"), average_purchase_price=Decimal("452.00")),
            Holding(user_id=user.id, asset_id=assets_by_symbol["VTSAX"].id, quantity=Decimal("18"), average_purchase_price=Decimal("240.50")),
        ]
        db.add_all(holdings)

        now = datetime.utcnow()

        # More realistic transaction history
        transactions = [
            Transaction(user_id=user.id, asset_id=assets_by_symbol["AAPL"].id, transaction_type="buy", quantity=Decimal("10"), price=Decimal("170.00"), transaction_date=now - timedelta(days=180)),
            Transaction(user_id=user.id, asset_id=assets_by_symbol["AAPL"].id, transaction_type="buy", quantity=Decimal("5"), price=Decimal("188.75"), transaction_date=now - timedelta(days=45)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["GOOGL"].id, transaction_type="buy", quantity=Decimal("12"), price=Decimal("151.80"), transaction_date=now - timedelta(days=120)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["NVDA"].id, transaction_type="buy", quantity=Decimal("2"), price=Decimal("720.00"), transaction_date=now - timedelta(days=150)),
            Transaction(user_id=user.id, asset_id=assets_by_symbol["NVDA"].id, transaction_type="buy", quantity=Decimal("2"), price=Decimal("860.00"), transaction_date=now - timedelta(days=30)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["BND"].id, transaction_type="buy", quantity=Decimal("20"), price=Decimal("69.80"), transaction_date=now - timedelta(days=220)),
            Transaction(user_id=user.id, asset_id=assets_by_symbol["BND"].id, transaction_type="buy", quantity=Decimal("10"), price=Decimal("71.00"), transaction_date=now - timedelta(days=35)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["AGG"].id, transaction_type="buy", quantity=Decimal("20"), price=Decimal("96.70"), transaction_date=now - timedelta(days=110)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["VFIAX"].id, transaction_type="buy", quantity=Decimal("6"), price=Decimal("440.00"), transaction_date=now - timedelta(days=250)),
            Transaction(user_id=user.id, asset_id=assets_by_symbol["VFIAX"].id, transaction_type="buy", quantity=Decimal("4"), price=Decimal("470.00"), transaction_date=now - timedelta(days=40)),

            Transaction(user_id=user.id, asset_id=assets_by_symbol["VTSAX"].id, transaction_type="buy", quantity=Decimal("10"), price=Decimal("232.00"), transaction_date=now - timedelta(days=140)),
            Transaction(user_id=user.id, asset_id=assets_by_symbol["VTSAX"].id, transaction_type="buy", quantity=Decimal("8"), price=Decimal("251.10"), transaction_date=now - timedelta(days=20)),

        ]
        db.add_all(transactions)

        db.commit()
        print("Seed data inserted successfully.")

    except Exception as e:
        db.rollback()
        print("Seed failed:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()