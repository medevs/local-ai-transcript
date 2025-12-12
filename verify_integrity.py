import os
import sys
import compileall

REQUIRED_FILES = [
    "frontend/src/App.tsx",
    "frontend/src/main.tsx",
    "frontend/src/components/nav-documents.tsx",
    "frontend/src/components/app-sidebar.tsx",
    "frontend/src/components/chatbot-panel.tsx",
    "frontend/src/components/transcript-panel.tsx",
    "backend/app.py",
    "backend/transcription.py",
    "backend/system_prompt.txt",
    "CODEBASE_GUIDE.md",
    "README.md",
]

def check_files_exist():
    missing = []
    for f in REQUIRED_FILES:
        if not os.path.exists(f):
            missing.append(f)
    return missing

def check_python_syntax():
    print("Checking Python syntax...")
    try:
        # This will compile all python files in backend/ and report errors
        if not compileall.compile_dir('backend', force=True, quiet=1):
            return False
        return True
    except Exception as e:
        print(f"Error checking python syntax: {e}")
        return False

def main():
    print("Starting Integrity Verification...")
    
    # 1. Check Files
    missing = check_files_exist()
    if missing:
        print("FAIL: Missing critical files:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)
    print("PASS: All critical files present.")

    # 2. Check Python Syntax
    if check_python_syntax():
        print("PASS: Python backend syntax is valid.")
    else:
        print("FAIL: Python syntax errors found.")
        sys.exit(1)

    print("\nVerification Successful! App structure is intact.")

if __name__ == "__main__":
    main()
