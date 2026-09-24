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

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
