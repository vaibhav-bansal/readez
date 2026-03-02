from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "ReadEz API"
    debug: bool = False
    environment: str = "development"

    # URLs
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/readez"

    # Google OAuth
    google_client_id: str
    google_client_secret: str

    # Session
    session_secret_key: str
    session_expire_days: int = 30

    # Storage
    storage_path: str = "./storage"

    # Dodo Payments - Test
    dodo_test_api_key: Optional[str] = None
    dodo_test_webhook_secret: Optional[str] = None
    dodo_test_pro_product_id: Optional[str] = None
    dodo_test_plus_product_id: Optional[str] = None

    # Dodo Payments - Live
    dodo_api_key: Optional[str] = None
    dodo_webhook_secret: Optional[str] = None
    dodo_pro_product_id: Optional[str] = None
    dodo_plus_product_id: Optional[str] = None

    # Dodo Payments - Additional webhook secrets
    dodo_subscription_webhook_secret: Optional[str] = None
    dodo_payment_webhook_secret: Optional[str] = None
    dodo_refund_webhook_secret: Optional[str] = None

    # Supabase (for migration)
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    supabase_secret_key: Optional[str] = None
    storage_bucket: Optional[str] = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def dodo_api_key_active(self) -> Optional[str]:
        return self.dodo_api_key if self.is_production else self.dodo_test_api_key

    @property
    def dodo_webhook_secret_active(self) -> Optional[str]:
        return self.dodo_webhook_secret if self.is_production else self.dodo_test_webhook_secret

    @property
    def dodo_pro_product_id_active(self) -> Optional[str]:
        return self.dodo_pro_product_id if self.is_production else self.dodo_test_pro_product_id

    @property
    def dodo_plus_product_id_active(self) -> Optional[str]:
        return self.dodo_plus_product_id if self.is_production else self.dodo_test_plus_product_id

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
