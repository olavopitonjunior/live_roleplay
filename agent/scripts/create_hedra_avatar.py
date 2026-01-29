"""
Script para criar avatares no Hedra via API.

Uso:
    python create_hedra_avatar.py <imagem.jpg> <nome>
    python create_hedra_avatar.py --generate <prompt> <nome>

Exemplos:
    python create_hedra_avatar.py avatar1.jpg "Avatar Vendedor"
    python create_hedra_avatar.py --generate "Professional cartoon salesperson" "Sales Avatar"
"""
import os
import sys
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from parent directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

HEDRA_API_KEY = os.getenv("HEDRA_API_KEY")
API_BASE = "https://api.hedra.com/web-app/public"

def create_asset(name: str, asset_type: str = "image") -> dict:
    """Create a new asset in Hedra and return the response."""
    headers = {
        "X-API-Key": HEDRA_API_KEY,
        "Content-Type": "application/json"
    }

    response = requests.post(
        f"{API_BASE}/assets",
        headers=headers,
        json={"name": name, "type": asset_type}
    )
    response.raise_for_status()
    return response.json()


def upload_image(asset_id: str, image_path: str) -> bool:
    """Upload an image file to an existing asset."""
    headers = {
        "X-API-Key": HEDRA_API_KEY,
    }

    with open(image_path, "rb") as f:
        # Use POST with multipart form data (per Hedra API docs)
        files = {"file": (Path(image_path).name, f, "image/png")}
        response = requests.post(
            f"{API_BASE}/assets/{asset_id}/upload",
            headers=headers,
            files=files
        )

    if response.status_code == 200:
        print(f"Upload response: {response.json()}")
        return True
    else:
        print(f"Upload failed: {response.status_code} - {response.text}")
        return False


def create_avatar_from_image(image_path: str, name: str) -> str:
    """Create a Hedra avatar from a local image file."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    print(f"Creating asset '{name}'...")
    asset = create_asset(name, "image")
    asset_id = asset["id"]
    print(f"Asset created: {asset_id}")

    print(f"Uploading image...")
    if upload_image(asset_id, image_path):
        print(f"Avatar created successfully!")
        print(f"\nAsset ID: {asset_id}")
        print(f"\nAdd this to your .env:")
        print(f"HEDRA_AVATAR_ID={asset_id}")
        return asset_id
    else:
        raise Exception("Failed to upload image")


def download_sample_avatar(output_path: str, style: str = "cartoon") -> str:
    """Download a sample avatar image for testing."""
    # Using Pravatar for realistic or DiceBear for cartoon
    if style == "cartoon":
        # DiceBear avataaars style
        url = "https://api.dicebear.com/7.x/avataaars/png?seed=sales&size=512&backgroundColor=f0f0f0"
    else:
        # Pravatar for realistic photos
        url = "https://i.pravatar.cc/512"

    print(f"Downloading sample {style} avatar...")
    response = requests.get(url)
    response.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(response.content)

    print(f"Downloaded to: {output_path}")
    return output_path


def list_assets() -> list:
    """List all assets in the Hedra account."""
    headers = {
        "X-API-Key": HEDRA_API_KEY,
    }

    response = requests.get(
        f"{API_BASE}/assets",
        headers=headers
    )
    response.raise_for_status()
    return response.json()


def main():
    if not HEDRA_API_KEY:
        print("Error: HEDRA_API_KEY not set in environment")
        print("Set it in agent/.env or as environment variable")
        sys.exit(1)

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "--list":
        print("Listing assets...")
        assets = list_assets()
        print(json.dumps(assets, indent=2))
        return

    if sys.argv[1] == "--download":
        style = sys.argv[2] if len(sys.argv) > 2 else "cartoon"
        output = sys.argv[3] if len(sys.argv) > 3 else f"sample_{style}_avatar.png"
        download_sample_avatar(output, style)
        return

    if sys.argv[1] == "--create-sample":
        # Create a sample cartoon avatar
        style = sys.argv[2] if len(sys.argv) > 2 else "cartoon"
        name = sys.argv[3] if len(sys.argv) > 3 else f"Sample {style.title()} Avatar"

        temp_path = f"temp_{style}_avatar.png"
        download_sample_avatar(temp_path, style)

        try:
            asset_id = create_avatar_from_image(temp_path, name)
            print(f"\nCreated {style} avatar: {asset_id}")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        return

    # Default: create avatar from provided image
    if len(sys.argv) < 3:
        print("Usage: python create_hedra_avatar.py <image_path> <name>")
        sys.exit(1)

    image_path = sys.argv[1]
    name = sys.argv[2]

    create_avatar_from_image(image_path, name)


if __name__ == "__main__":
    main()
