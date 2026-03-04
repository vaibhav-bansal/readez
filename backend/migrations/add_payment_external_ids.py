"""
Migration: Add missing columns to payments table.

Columns: dodo_invoice_id, dodo_refund_id, refund_amount, refunded_at

Run with: python -m migrations.add_payment_external_ids
"""
import asyncio
from sqlalchemy import text
from app.database import engine


COLUMNS_TO_ADD = [
    ("dodo_invoice_id", "VARCHAR(255)", True),
    ("dodo_refund_id", "VARCHAR(255)", True),
    ("refund_amount", "BIGINT", False),
    ("refunded_at", "TIMESTAMP", False),
]


async def migrate():
    async with engine.begin() as conn:
        # Check which columns already exist
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'payments'
            AND column_name IN ('dodo_invoice_id', 'dodo_refund_id', 'refund_amount', 'refunded_at')
        """))
        existing = {row[0] for row in result.fetchall()}

        for col_name, col_type, add_index in COLUMNS_TO_ADD:
            if col_name not in existing:
                await conn.execute(text(
                    f"ALTER TABLE payments ADD COLUMN {col_name} {col_type}"
                ))
                if add_index:
                    await conn.execute(text(
                        f"CREATE INDEX ix_payments_{col_name} ON payments ({col_name})"
                    ))
                print(f"Added {col_name} column")
            else:
                print(f"{col_name} already exists, skipping")

    print("Migration complete")


if __name__ == "__main__":
    asyncio.run(migrate())
