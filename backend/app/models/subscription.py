import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Integer, BigInteger, ForeignKey, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    PLUS = "plus"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    TRIALING = "trialing"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    tier = Column(String(20), default=SubscriptionTier.FREE.value, nullable=False)
    status = Column(String(20), default=SubscriptionStatus.ACTIVE.value, nullable=False)
    dodo_subscription_id = Column(String(255), unique=True, nullable=True, index=True)
    dodo_customer_id = Column(String(255), nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="subscription")
    payments = relationship("Payment", back_populates="subscription", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Subscription {self.user_id} - {self.tier}>"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    dodo_payment_id = Column(String(255), unique=True, nullable=True, index=True)
    amount = Column(BigInteger, nullable=False)  # In cents
    currency = Column(String(10), default="USD", nullable=False)
    status = Column(String(20), nullable=False)  # succeeded, failed, refunded
    refund_amount = Column(BigInteger, nullable=True)  # In cents
    refunded_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    webhook_data = Column(String, nullable=True)  # JSON string of full Dodo payload
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="payments")
    subscription = relationship("Subscription", back_populates="payments")

    def __repr__(self):
        return f"<Payment {self.dodo_payment_id} - {self.amount}>"


class SubscriptionUsage(Base):
    __tablename__ = "subscription_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    feature = Column(String(50), nullable=False)  # ai_summaries, storage_bytes, etc.
    usage_count = Column(Integer, default=0, nullable=False)
    reset_at = Column(DateTime, nullable=True)  # Monthly reset date
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="subscription_usage")

    def __repr__(self):
        return f"<SubscriptionUsage {self.user_id} - {self.feature}>"
