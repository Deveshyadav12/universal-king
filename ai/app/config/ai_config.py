"""
AI Service Configuration
Central configuration for AI services, models, and behaviors
"""

import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
@dataclass
class AIConfig:
    """AI Service Configuration"""
    
    # Service settings
    service_name: str = "HexaWave AI"
    service_version: str = "0.7.0"
    service_token: str = ""
    service_url: str = "http://127.0.0.1:8000"
    
    # Database settings
    database_url: Optional[str] = None
    use_database: bool = True
    
    # AI Generation settings
    default_generation_mode: str = "fast"
    max_projects_per_day: int = 100
    max_files_per_project: int = 50
    max_file_size: int = 100000  # 100KB
    
    # Discovery settings
    auto_discovery_enabled: bool = True
    discovery_interval_minutes: int = 60
    leads_per_day: int = 100
    discovery_queries_per_day: int = 20
    
    # AI Models
    available_models: Dict[str, Any] = field(default_factory=dict)
    primary_model: str = "hexawave-local"
    fallback_model: str = "offline"
    
    # Performance
    max_concurrent_tasks: int = 5
    task_timeout_seconds: int = 300
    
    # Caching
    enable_caching: bool = True
    cache_ttl_seconds: int = 3600  # 1 hour
    
    # Offline mode
    offline_mode: bool = False
    fallback_strategy: str = "template"  # template, mock, error
    
        # Security
    require_auth: bool = True
    allowed_origins: List[str] = field(
        default_factory=lambda: [
            "https://jaipurstore.tech",
            "https://www.jaipurstore.tech",
        ]
    )
    
    def __post_init__(self):
        """Post-initialization configuration"""
        # Load from environment
        self.service_token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", self.service_token)
        self.service_url = os.getenv("HEXAWAVE_AI_URL", self.service_url)
        self.database_url = os.getenv("DATABASE_URL")
        
        # Use database if URL is configured
        self.use_database = bool(self.database_url)
        
        # Auto-discovery
        self.auto_discovery_enabled = os.getenv("AUTO_DISCOVERY_ENABLED", "true").lower() == "true"
        
        # Offline mode
        self.offline_mode = os.getenv("AI_OFFLINE_MODE", "false").lower() == "true"
        
        # Security
        self.require_auth = os.getenv("AI_REQUIRE_AUTH", "true").lower() == "true"
        
        # Initialize models
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize available AI models"""
        self.available_models = {
            "hexawave-local": {
                "name": "HexaWave Local",
                "type": "local",
                "endpoint": self.service_url,
                "timeout": 300,
                "priority": 10,
                "capabilities": ["generate", "edit", "score", "maintain", "build"]
            },
            "tavily": {
                "name": "Tavily Search",
                "type": "search",
                "endpoint": "https://api.tavily.com",
                "timeout": 30,
                "priority": 8,
                "capabilities": ["search", "discovery"]
            }
        }
        
        # Add Azure OpenAI if configured
        if os.getenv("AZURE_OPENAI_ENDPOINT"):
            self.available_models["azure-gpt4"] = {
                "name": "Azure GPT-4",
                "type": "llm",
                "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
                "timeout": 60,
                "priority": 9,
                "capabilities": ["generate", "edit", "analyze"]
            }
        
        # Add OpenAI if configured
        if os.getenv("OPENAI_API_KEY"):
            self.available_models["openai-gpt4"] = {
                "name": "OpenAI GPT-4",
                "type": "llm",
                "endpoint": "https://api.openai.com/v1",
                "timeout": 60,
                "priority": 9,
                "capabilities": ["generate", "edit", "analyze"]
            }
    
    def get_model_for_task(self, task: str) -> Optional[str]:
        """Get the best model for a specific task"""
        for model_name, model_info in self.available_models.items():
            if task in model_info.get("capabilities", []):
                return model_name
        return None
    
    def is_task_available(self, task: str) -> bool:
        """Check if a task is available with current models"""
        return self.get_model_for_task(task) is not None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            "service_name": self.service_name,
            "service_version": self.service_version,
            "service_url": self.service_url,
            "database_enabled": self.use_database,
            "auto_discovery_enabled": self.auto_discovery_enabled,
            "offline_mode": self.offline_mode,
            "require_auth": self.require_auth,
            "available_models": list(self.available_models.keys()),
            "primary_model": self.primary_model
        }


# Global configuration instance
config = AIConfig()


def get_config() -> AIConfig:
    """Get the global configuration"""
    return config


def reload_config():
    """Reload configuration from environment"""
    global config
    config = AIConfig()
    return config
