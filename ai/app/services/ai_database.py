"""
PostgreSQL Database Service for AI Module
Handles project storage, retrieval, and AI workflow state
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, List, Any
import psycopg2
from psycopg2 import pool, sql
from psycopg2.extensions import ISOLATION_LEVEL_READ_COMMITTED


class AIDatabaseService:
    """
    PostgreSQL database service for AI-generated projects and workflows.
    Provides fast, persistent storage for AI workspaces and generated code.
    """
    
    def __init__(self):
        self.connection_pool = None
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the connection pool"""
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            print("WARNING: DATABASE_URL not configured, using in-memory storage")
            self.connection_pool = None
            return
        
        try:
            self.connection_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=db_url,
            )
            
            # Initialize database schema
            with self._get_connection() as conn:
                self._initialize_schema(conn)
            
            print("AI PostgreSQL database connected")
        except Exception as e:
            print(f"WARNING: Could not connect to PostgreSQL: {e}")
            self.connection_pool = None
    
    def _get_connection(self):
        """Get a connection from the pool"""
        if not self.connection_pool:
            raise RuntimeError("Database not configured")
        return self.connection_pool.getconn()
    
    def _release_connection(self, conn):
        """Release a connection back to the pool"""
        if self.connection_pool and conn:
            self.connection_pool.putconn(conn)
    
    def _initialize_schema(self, conn):
        """Initialize database schema for AI projects"""
        with conn.cursor() as cursor:
            # AI Projects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_projects (
                    id UUID PRIMARY KEY,
                    project_id VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    project_type VARCHAR(100),
                    stack VARCHAR(100),
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    generation_mode VARCHAR(20) DEFAULT 'fast',
                    
                    -- AI Analysis
                    architecture JSONB DEFAULT '{}',
                    features TEXT[] DEFAULT '{}',
                    
                    -- Build info
                    build_passed BOOLEAN DEFAULT false,
                    build_attempts INTEGER DEFAULT 0,
                    build_errors TEXT[] DEFAULT '{}',
                    build_stage VARCHAR(100),
                    build_stdout TEXT,
                    build_stderr TEXT,
                    
                    -- Test info
                    test_passed BOOLEAN DEFAULT false,
                    test_errors TEXT[] DEFAULT '{}',
                    
                    -- Files
                    file_count INTEGER DEFAULT 0,
                    files JSONB DEFAULT '[]',
                    
                    -- Process
                    process_pid INTEGER,
                    process_port INTEGER,
                    process_status VARCHAR(50),
                    process_started_at TIMESTAMP WITH TIME ZONE,
                    
                    -- Timestamps
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    completed_at TIMESTAMP WITH TIME ZONE
                )
            """)
            
            # AI Workspace files table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_files (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id VARCHAR(50) NOT NULL,
                    file_path VARCHAR(1024) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    language VARCHAR(100),
                    content TEXT NOT NULL,
                    size_bytes INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(project_id, file_path)
                )
            """)
            
            # AI Project metadata table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_metadata (
                    project_id VARCHAR(50) PRIMARY KEY,
                    metadata JSONB DEFAULT '{}',
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            # AI Audit logs
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_audit (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id VARCHAR(50),
                    action VARCHAR(100) NOT NULL,
                    details JSONB DEFAULT '{}',
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            # Indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_projects_id ON ai_projects(id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_projects_project_id ON ai_projects(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_projects_status ON ai_projects(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_projects_created ON ai_projects(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_files_project ON ai_files(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_files_path ON ai_files(file_path)")
            
            conn.commit()
    
    def is_available(self) -> bool:
        """Check if database is available"""
        if not self.connection_pool:
            return False
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    return True
        except:
            return False
    
    # Project CRUD operations
    def create_project(
        self,
        project_id: str,
        name: str,
        project_type: str,
        stack: str,
        description: str = "",
        generation_mode: str = "fast"
    ) -> Dict[str, Any]:
        """Create a new AI project record"""
        if not self.connection_pool:
            return {"id": project_id, "status": "pending"}
        
        import uuid
        project_uuid = str(uuid.uuid4())
        
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO ai_projects (
                        id, project_id, name, project_type, stack, description, 
                        generation_mode, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (project_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        project_type = EXCLUDED.project_type,
                        stack = EXCLUDED.stack,
                        description = EXCLUDED.description,
                        generation_mode = EXCLUDED.generation_mode,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                    RETURNING *
                """, (
                    project_uuid,
                    project_id,
                    name,
                    project_type,
                    stack,
                    description,
                    generation_mode,
                    "pending"
                ))
                conn.commit()
                row = cursor.fetchone()
                if row:
                    return dict(row)
        
        return {"id": project_uuid, "project_id": project_id, "status": "pending"}
    
    def update_project_status(
        self,
        project_id: str,
        status: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Update project status"""
        if not self.connection_pool:
            return True
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        UPDATE ai_projects 
                        SET status = %s, updated_at = NOW()
                        WHERE project_id = %s
                        RETURNING id
                    """, (status, project_id))
                    conn.commit()
                    return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating project status: {e}")
            return False
    
    def update_project(
        self,
        project_id: str,
        **kwargs
    ) -> bool:
        """Update project fields"""
        if not self.connection_pool:
            return True
        
        try:
            if not kwargs:
                return True
            
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    updates = []
                    values = []
                    for key, value in kwargs.items():
                        updates.append(f"{key} = %s")
                        values.append(value)
                    
                    values.append(project_id)
                    updates.append("updated_at = NOW()")
                    
                    query = f"""
                        UPDATE ai_projects 
                        SET {', '.join(updates)}
                        WHERE project_id = %s
                        RETURNING id
                    """
                    cursor.execute(query, values)
                    conn.commit()
                    return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating project: {e}")
            return False
    
    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project by ID"""
        if not self.connection_pool:
            return None
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT * FROM ai_projects WHERE project_id = %s",
                        (project_id,)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
        except:
            pass
        return None
    
    def list_projects(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all projects, optionally filtered by status"""
        if not self.connection_pool:
            return []
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    if status:
                        cursor.execute(
                            "SELECT * FROM ai_projects WHERE status = %s ORDER BY created_at DESC",
                            (status,)
                        )
                    else:
                        cursor.execute(
                            "SELECT * FROM ai_projects ORDER BY created_at DESC"
                        )
                    return [dict(row) for row in cursor.fetchall()]
        except:
            return []
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its files"""
        if not self.connection_pool:
            return True
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    # Delete files first
                    cursor.execute(
                        "DELETE FROM ai_files WHERE project_id = %s",
                        (project_id,)
                    )
                    # Delete metadata
                    cursor.execute(
                        "DELETE FROM ai_metadata WHERE project_id = %s",
                        (project_id,)
                    )
                    # Delete audit logs
                    cursor.execute(
                        "DELETE FROM ai_audit WHERE project_id = %s",
                        (project_id,)
                    )
                    # Delete project
                    cursor.execute(
                        "DELETE FROM ai_projects WHERE project_id = %s",
                        (project_id,)
                    )
                    conn.commit()
                    return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting project: {e}")
            return False
    
    # File operations
    def save_file(
        self,
        project_id: str,
        file_path: str,
        file_name: str,
        content: str,
        language: str = ""
    ) -> bool:
        """Save a file for a project"""
        if not self.connection_pool:
            return True
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    # Check if file exists
                    cursor.execute(
                        "SELECT id FROM ai_files WHERE project_id = %s AND file_path = %s",
                        (project_id, file_path)
                    )
                    
                    if cursor.fetchone():
                        # Update existing
                        cursor.execute("""
                            UPDATE ai_files 
                            SET content = %s, language = %s, size_bytes = %s, updated_at = NOW()
                            WHERE project_id = %s AND file_path = %s
                        """, (
                            content,
                            language,
                            len(content),
                            project_id,
                            file_path
                        ))
                    else:
                        # Insert new
                        import uuid
                        file_id = str(uuid.uuid4())
                        cursor.execute("""
                            INSERT INTO ai_files 
                            (id, project_id, file_path, file_name, language, content, size_bytes)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            file_id,
                            project_id,
                            file_path,
                            file_name,
                            language,
                            content,
                            len(content)
                        ))
                    
                    conn.commit()
                    
                    # Update project file count
                    cursor.execute(
                        "SELECT COUNT(*) FROM ai_files WHERE project_id = %s",
                        (project_id,)
                    )
                    file_count = cursor.fetchone()[0]
                    cursor.execute(
                        "UPDATE ai_projects SET file_count = %s, files = files, updated_at = NOW() WHERE project_id = %s",
                        (file_count, project_id)
                    )
                    conn.commit()
                    
                    return True
        except Exception as e:
            print(f"Error saving file: {e}")
            return False
    
    def get_file(self, project_id: str, file_path: str) -> Optional[str]:
        """Get file content by path"""
        if not self.connection_pool:
            return None
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT content FROM ai_files WHERE project_id = %s AND file_path = %s",
                        (project_id, file_path)
                    )
                    row = cursor.fetchone()
                    if row:
                        return row[0]
        except:
            pass
        return None
    
    def list_files(self, project_id: str) -> List[Dict[str, Any]]:
        """List all files for a project"""
        if not self.connection_pool:
            return []
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT file_path, file_name, language, size_bytes, created_at, updated_at FROM ai_files WHERE project_id = %s ORDER BY file_path",
                        (project_id,)
                    )
                    return [dict(row) for row in cursor.fetchall()]
        except:
            return []
    
    def delete_file(self, project_id: str, file_path: str) -> bool:
        """Delete a file from a project"""
        if not self.connection_pool:
            return True
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM ai_files WHERE project_id = %s AND file_path = %s",
                        (project_id, file_path)
                    )
                    conn.commit()
                    
                    # Update project file count
                    cursor.execute(
                        "SELECT COUNT(*) FROM ai_files WHERE project_id = %s",
                        (project_id,)
                    )
                    file_count = cursor.fetchone()[0]
                    cursor.execute(
                        "UPDATE ai_projects SET file_count = %s, updated_at = NOW() WHERE project_id = %s",
                        (file_count, project_id)
                    )
                    conn.commit()
                    
                    return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting file: {e}")
            return False
    
    # Metadata operations
    def update_metadata(self, project_id: str, metadata: Dict) -> bool:
        """Update project metadata"""
        if not self.connection_pool:
            return True
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO ai_metadata (project_id, metadata)
                        VALUES (%s, %s)
                        ON CONFLICT (project_id) DO UPDATE SET
                            metadata = EXCLUDED.metadata,
                            updated_at = NOW()
                    """, (
                        project_id,
                        json.dumps(metadata)
                    ))
                    conn.commit()
                    return True
        except Exception as e:
            print(f"Error updating metadata: {e}")
            return False
    
    def get_metadata(self, project_id: str) -> Dict:
        """Get project metadata"""
        if not self.connection_pool:
            return {}
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT metadata FROM ai_metadata WHERE project_id = %s",
                        (project_id,)
                    )
                    row = cursor.fetchone()
                    if row and row[0]:
                        return json.loads(row[0])
        except:
            pass
        return {}
    
    # Audit operations
    def log_audit(
        self,
        project_id: str,
        action: str,
        details: Optional[Dict] = None
    ):
        """Log an audit event"""
        if not self.connection_pool:
            return
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO ai_audit (project_id, action, details)
                        VALUES (%s, %s, %s)
                    """, (
                        project_id,
                        action,
                        json.dumps(details or {})
                    ))
                    conn.commit()
        except:
            pass
    
    def get_audit_logs(self, project_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
        """Get audit logs"""
        if not self.connection_pool:
            return []
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    if project_id:
                        cursor.execute(
                            "SELECT * FROM ai_audit WHERE project_id = %s ORDER BY timestamp DESC LIMIT %s",
                            (project_id, limit)
                        )
                    else:
                        cursor.execute(
                            "SELECT * FROM ai_audit ORDER BY timestamp DESC LIMIT %s",
                            (limit,)
                        )
                    return [dict(row) for row in cursor.fetchall()]
        except:
            return []
    
    # Bulk operations for performance
    def save_files_bulk(self, project_id: str, files: List[Dict]) -> bool:
        """Save multiple files in a single transaction"""
        if not self.connection_pool:
            return True
        
        try:
            import uuid
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    # Delete existing files for this project
                    cursor.execute(
                        "DELETE FROM ai_files WHERE project_id = %s",
                        (project_id,)
                    )
                    
                    # Insert new files
                    for file in files:
                        file_id = str(uuid.uuid4())
                        cursor.execute("""
                            INSERT INTO ai_files 
                            (id, project_id, file_path, file_name, language, content, size_bytes)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            file_id,
                            project_id,
                            file.get("name", ""),
                            file.get("name", ""),
                            file.get("language", ""),
                            file.get("content", ""),
                            len(file.get("content", ""))
                        ))
                    
                    # Update project
                    cursor.execute("""
                        UPDATE ai_projects 
                        SET file_count = %s, files = %s, updated_at = NOW()
                        WHERE project_id = %s
                    """, (
                        len(files),
                        json.dumps([f["name"] for f in files]),
                        project_id
                    ))
                    
                    conn.commit()
                    return True
        except Exception as e:
            print(f"Error saving files bulk: {e}")
            return False
    
    def get_project_files(self, project_id: str) -> List[Dict]:
        """Get all files for a project"""
        if not self.connection_pool:
            return []
        
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT * FROM ai_files WHERE project_id = %s ORDER BY file_path",
                        (project_id,)
                    )
                    files = [dict(row) for row in cursor.fetchall()]
                    
                    # Also get project info
                    cursor.execute(
                        "SELECT * FROM ai_projects WHERE project_id = %s",
                        (project_id,)
                    )
                    project = cursor.fetchone()
                    
                    return {
                        "project": dict(project) if project else None,
                        "files": files
                    }
        except:
            return {"project": None, "files": []}


# Singleton instance
database_service = AIDatabaseService()
