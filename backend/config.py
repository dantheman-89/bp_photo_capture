from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    anthropic_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]  # override in prod via CORS_ORIGINS env var
    active_provider: str = "openai"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
