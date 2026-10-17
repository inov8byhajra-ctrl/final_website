from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from app.core.database import base

class BusinessData(base):
    __tablename__ = "business_data"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False, index=True)
    cfo_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    order_id = Column(String, index=True)
    order_date = Column(Date, index=True)
    ship_date = Column(Date)
    ship_mode = Column(String)
    customer_id = Column(String)
    customer_name = Column(String)
    segment = Column(String)
    country = Column(String)
    state = Column(String)
    city = Column(String)
    region = Column(String, index=True)   # manager RBAC filter
    product_id = Column(String)
    category = Column(String, index=True)
    sub_category = Column(String)
    product_name = Column(String)
    sales = Column(Float)
    quantity = Column(Integer)
    discount = Column(Float)
    profit = Column(Float)
    unit_cost = Column(Float)    # derived in service
    net_profit = Column(Float)   # derived in service