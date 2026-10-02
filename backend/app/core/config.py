from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Shwe Muse HMS"
    secret_key: str = "dev-secret-change-me-shwe-muse"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    refresh_token_expire_days: int = 7
    database_url: str = "sqlite:///./shwemuse.db"
    seed_on_start: bool = True
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173"
    session_timeout_minutes: int = 30
    password_min_length: int = 8
    sms_enabled: bool = True
    whatsapp_enabled: bool = False
    demo_otp: str = "123456"
    # Shared secret a branch's scripts/push_sync.py cron job sends in the
    # X-Sync-Key header when pushing its daily rollup to the cloud Admin Panel
    # instance — there's no logged-in user for an unattended cron push, so this
    # is a separate, simpler auth path from the JWT login flow everything else uses.
    sync_shared_key: str = "dev-sync-key-change-me-shwe-muse"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
