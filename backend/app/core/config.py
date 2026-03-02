from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SOAR Workflow Studio"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "replace-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    db_user: str = "soar"
    db_password: str = "soar"
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "soar"

    llm_provider: str = "mock"
    llm_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
