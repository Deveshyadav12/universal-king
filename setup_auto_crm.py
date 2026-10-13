#!/usr/bin/env python3
"""
Automatic CRM Setup Script
This script sets up the complete automatic lead discovery and AI system
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")

def print_success(text):
    print(f"✅ {text}")

def print_warning(text):
    print(f"⚠️  {text}")

def print_error(text):
    print(f"❌ {text}")

def check_python_packages():
    """Check if required Python packages are installed"""
    print_header("Checking Python Packages")
    
    required_packages = [
        "fastapi",
        "uvicorn",
        "psycopg2",
        "httpx",
        "python-dotenv"
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print_success(f"{package} is installed")
        except ImportError:
            missing.append(package)
            print_error(f"{package} is NOT installed")
    
    return missing

def check_node_packages():
    """Check if required Node.js packages are installed"""
    print_header("Checking Node.js Packages")
    
    try:
        # Check if we're in the backend directory
        backend_dir = Path("backend")
        if backend_dir.exists():
            os.chdir("backend")
            
            # Check package.json exists
            if Path("package.json").exists():
                print_success("package.json exists")
                
                # Check if node_modules exists
                if Path("node_modules").exists():
                    print_success("node_modules exists")
                else:
                    print_warning("node_modules does not exist - run 'npm install'")
                    return False
                
                return True
            else:
                print_error("package.json not found in backend directory")
                return False
        else:
            print_error("backend directory not found")
            return False
    except Exception as e:
        print_error(f"Error checking Node.js packages: {e}")
        return False
    finally:
        os.chdir("..")

def check_postgresql():
    """Check if PostgreSQL is running and accessible"""
    print_header("Checking PostgreSQL")
    
    try:
        import psycopg2
        
        # Try to connect
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="postgres",
            password="",
            dbname="postgres"
        )
        conn.close()
        print_success("PostgreSQL is running and accessible")
        return True
    except psycopg2.OperationalError as e:
        print_error(f"PostgreSQL connection failed: {e}")
        print_warning("Make sure PostgreSQL is running:")
        print_warning("  - Start PostgreSQL service")
        print_warning("  - Or use Docker: docker run --name hexawave-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres")
        return False
    except ImportError:
        print_error("psycopg2 not installed - cannot check PostgreSQL")
        return False

def check_database_schema():
    """Check if database schema is set up"""
    print_header("Checking Database Schema")
    
    schema_file = Path("infrastructure/database/schema.sql")
    if schema_file.exists():
        print_success("Database schema file exists")
        
        # Check if it contains leads table
        content = schema_file.read_text()
        if "leads" in content.lower():
            print_success("Leads table is defined in schema")
        else:
            print_warning("Leads table might not be in schema.sql")
        
        return True
    else:
        print_error("Database schema file not found")
        return False

def create_env_files():
    """Create .env files from examples if they don't exist"""
    print_header("Creating Environment Files")
    
    files_to_create = [
        ("backend/.env", "backend/.env.example"),
        ("ai/.env", "ai/.env.example"),
    ]
    
    for target, source in files_to_create:
        target_path = Path(target)
        source_path = Path(source)
        
        if not target_path.exists() and source_path.exists():
            # Copy the example file
            content = source_path.read_text()
            target_path.write_text(content)
            print_success(f"Created {target} from {source}")
        elif target_path.exists():
            print_success(f"{target} already exists")
        else:
            print_error(f"{source} not found - cannot create {target}")

def check_configuration():
    """Check if required configuration is set"""
    print_header("Checking Configuration")
    
    backend_env = Path("backend/.env")
    ai_env = Path("ai/.env")
    
    required_backend = ["DATABASE_URL", "HEXAWAVE_AI_SERVICE_TOKEN"]
    required_ai = ["HEXAWAVE_AI_SERVICE_TOKEN", "DATABASE_URL"]
    
    if backend_env.exists():
        content = backend_env.read_text()
        for key in required_backend:
            if key in content and not content.split(key)[1].split("=")[0].strip().endswith("="):
                print_success(f"Backend: {key} is configured")
            else:
                print_warning(f"Backend: {key} is NOT configured")
    else:
        print_warning("backend/.env does not exist")
    
    if ai_env.exists():
        content = ai_env.read_text()
        for key in required_ai:
            if key in content and not content.split(key)[1].split("=")[0].strip().endswith("="):
                print_success(f"AI: {key} is configured")
            else:
                print_warning(f"AI: {key} is NOT configured")
    else:
        print_warning("ai/.env does not exist")

def generate_sample_token():
    """Generate a sample service token"""
    import secrets
    token = secrets.token_hex(32)
    return token

def setup_database():
    """Set up PostgreSQL databases"""
    print_header("Setting Up PostgreSQL Databases")
    
    try:
        import psycopg2
        
        # Try to connect to default postgres database
        try:
            conn = psycopg2.connect(
                host="localhost",
                port=5432,
                user="postgres",
                password="",
                dbname="postgres"
            )
            cursor = conn.cursor()
            
            # Create hexawave database
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'hexawave'")
            if cursor.fetchone() is None:
                cursor.execute("CREATE DATABASE hexawave")
                print_success("Created hexawave database")
            else:
                print_success("hexawave database already exists")
            
            # Create hexawave_ai database
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'hexawave_ai'")
            if cursor.fetchone() is None:
                cursor.execute("CREATE DATABASE hexawave_ai")
                print_success("Created hexawave_ai database")
            else:
                print_success("hexawave_ai database already exists")
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return True
            
        except psycopg2.OperationalError as e:
            print_error(f"Cannot connect to PostgreSQL: {e}")
            return False
            
    except ImportError:
        print_error("psycopg2 not installed - cannot setup database")
        return False

def main():
    print("\n" + "=" * 60)
    print("  AUTOMATIC CRM SETUP SCRIPT")
    print("  Automatic AI-Powered Lead Discovery & Management")
    print("=" * 60 + "\n")
    
    # Step 1: Create environment files
    create_env_files()
    
    # Step 2: Check Python packages
    missing_python = check_python_packages()
    
    # Step 3: Check Node.js packages
    node_ok = check_node_packages()
    
    # Step 4: Check PostgreSQL
    pg_ok = check_postgresql()
    
    # Step 5: Check database schema
    schema_ok = check_database_schema()
    
    # Step 6: Check configuration
    check_configuration()
    
    # Step 7: Setup database
    if pg_ok:
        setup_database()
    
    # Summary
    print_header("Setup Summary")
    
    issues = []
    if missing_python:
        issues.append(f"Missing Python packages: {', '.join(missing_python)}")
    if not node_ok:
        issues.append("Node.js packages not installed")
    if not pg_ok:
        issues.append("PostgreSQL not running")
    if not schema_ok:
        issues.append("Database schema issues")
    
    if issues:
        print_error("Issues found:")
        for issue in issues:
            print(f"  - {issue}")
        print("\nPlease fix these issues and run the setup again.")
    else:
        print_success("All checks passed!")
        print("\nNext steps:")
        print("  1. Update your .env files with proper credentials")
        print("  2. Start PostgreSQL if not running")
        print("  3. Run database migrations:")
        print("     cd backend && npm run start:dev")
        print("     cd ai/app && python main.py")
        print("\nThe system will:")
        print("  ✓ Automatically discover leads (no manual 'Discover now' needed)")
        print("  ✓ Score leads with AI (with offline fallback)")
        print("  ✓ Store all data in PostgreSQL")
        print("  ✓ Handle clients automatically")
        print("  ✓ Work fast with concurrent processing")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
