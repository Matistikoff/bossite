"""Build gallery metadata and web-ready images from local source photos."""

from __future__ import annotations

import json
import re
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "assets" / "images"
THUMBNAILS_DIR = IMAGES_DIR / "thumbnails"
WEB_IMAGES_DIR = ROOT / "assets" / "web-images"
DATA_FILE = ROOT / "rolls" / "data.js"
DATA_PREFIX = "window.ROLLS_ARCHIVE = "
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
THUMBNAIL_SIZE = (1000, 800)
WEB_IMAGE_SIZE = (3200, 3200)
LOGICAL_ROLL_COUNTS = {
    "20...32_Indonezia": 13,
    "40...41_Ukrajina": 2,
}
ROLL_LABELS = {
    "1_The_First": "Prvý",
    "2_Home": "Domov",
    "3_Filip_Fodbal": "Filip Futbal",
    "4_BA_Saska_Miska": "BA Saška Miška",
    "5_BW_BA": "ČB BA",
    "6_OkoloVianoc24": "Okolo Vianoc",
    "7_Chata24": "Chata",
    "8_Vianoce24": "Vianoce",
    "9_StefanskyVystup24": "Štefanský výstup",
    "10_OkoloVianoc24": "Okolo Vianoc",
    "11_Macedonsko25": "Macedónsko",
    "12_Lost": "Stratené",
    "13_Lyziarsky": "Lyžiarsky",
    "14_KrojeSkate": "Kroje a skejt",
    "15_Slovinsko25": "Slovinsko",
    "16_Zuberec_BA": "Zuberec BA",
    "17_Inzinier": "Inžinier",
    "18_LiubovTura_Promocie": "Liubov Túra Promócie",
    "19_BW2": "ČB2",
    "20...32_Indonezia": "Indonézia",
    "33_SlovinskoLiubov": "Slovinsko Liubov",
    "34_Forsta25": "Forsta",
    "35_Godfather": "Krstný otec",
    "36_LiubovBarla": "Liubov Barla",
    "37_Prve_Svate_Prijimanie": "Prvé sväté prijímanie",
    "38_LiubovPraha": "Liubov Praha",
    "39_Budapest": "Budapešť",
    "40...41_Ukrajina": "Ukrajina",
    "40_Pohoda": "Pohoda",
    "42_Vienna": "Viedeň",
}
ROLL_HEROES = {
    "1_The_First": "skodovka",
    "2_Home": "20241109_225821551_iOS_nasiADom",
    "3_Filip_Fodbal": "20241113_221349995_iOS_akcia",
    "4_BA_Saska_Miska": "20241123_204903783_iOS_the_portrait",
    "5_BW_BA": "20241210_114901079_iOS_ufoPetr",
    "6_OkoloVianoc24": "karlovkaFromHell",
    "7_Chata24": "chata",
    "8_Vianoce24": "pripravy",
    "9_StefanskyVystup24": "000038_dobryVecer",
    "10_OkoloVianoc24": "peknyMilotin",
}

CATEGORIES = [
    {"id": "portraits", "label": "Portréty", "emoji": "👤"},
    {"id": "landscapes", "label": "Krajiny", "emoji": "🏞️"},
    {"id": "macro", "label": "Makro / detaily", "emoji": "🔍"},
    {"id": "street", "label": "Ulica", "emoji": "🚶"},
    {"id": "architecture", "label": "Architektúra", "emoji": "🏛️"},
    {"id": "nature", "label": "Príroda", "emoji": "🌿"},
    {"id": "still-life", "label": "Zátišie", "emoji": "🍎"},
    {"id": "abstract", "label": "Abstrakt", "emoji": "🎨"},
]


def natural_key(value: str) -> list[int | str]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def roll_number(folder_name: str) -> int:
    match = re.match(r"(\d+)", folder_name)
    return int(match.group(1)) if match else 0


def roll_label(folder_name: str) -> str:
    if folder_name in ROLL_LABELS:
        return ROLL_LABELS[folder_name]
    without_prefix = re.sub(r"^\d+(?:\.\.\.\d+)?_?", "", folder_name)
    return without_prefix.replace("_", " ").strip() or folder_name


def image_files(roll_dir: Path) -> list[Path]:
    files = [
        path
        for path in roll_dir.rglob("*")
        if path.is_file() and path.suffix.casefold() in SUPPORTED_EXTENSIONS
    ]
    return sorted(files, key=lambda path: natural_key(path.relative_to(roll_dir).as_posix()))


def create_thumbnail(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp")
    temporary.unlink(missing_ok=True)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.save(temporary, "WEBP", quality=78, method=6)
    temporary.replace(destination)


def create_web_image(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp")
    temporary.unlink(missing_ok=True)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail(WEB_IMAGE_SIZE, Image.Resampling.LANCZOS)
        if image.mode != "RGB":
            image = image.convert("RGB")
        image.save(temporary, "WEBP", quality=88, method=4)
    temporary.replace(destination)


def is_current_image(source: Path, destination: Path) -> bool:
    if not destination.exists() or destination.stat().st_mtime < source.stat().st_mtime:
        return False
    try:
        with Image.open(destination) as image:
            image.verify()
    except (OSError, UnidentifiedImageError):
        return False
    return True


def generate_asset(job: tuple[str, Path, Path]) -> str:
    kind, source, destination = job
    if kind == "thumbnail":
        create_thumbnail(source, destination)
    else:
        create_web_image(source, destination)
    return kind


def prune_generated_assets(root: Path, expected: set[Path]) -> int:
    """Remove generated WebPs that no longer have a corresponding source photo."""
    removed = 0
    if not root.exists():
        return removed

    for generated in root.rglob("*.webp"):
        if generated not in expected:
            generated.unlink()
            removed += 1

    for directory in sorted(
        (path for path in root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    ):
        try:
            directory.rmdir()
        except OSError:
            pass

    return removed


def load_existing_categories() -> dict[tuple[str, str], list[str]]:
    """Read category assignments from the current generated archive."""
    if not DATA_FILE.exists():
        return {}

    contents = DATA_FILE.read_text(encoding="utf-8").strip()
    if not contents.startswith(DATA_PREFIX) or not contents.endswith(";"):
        raise ValueError(
            f"Cannot preserve categories because {DATA_FILE} has an unexpected format."
        )

    try:
        archive = json.loads(contents[len(DATA_PREFIX) : -1])
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Cannot preserve categories because {DATA_FILE} is not valid archive data."
        ) from error

    categories: dict[tuple[str, str], list[str]] = {}
    for roll in archive.get("rolls", []):
        roll_id = roll.get("id")
        if not isinstance(roll_id, str):
            continue
        for photo in roll.get("photos", []):
            file = photo.get("file")
            photo_categories = photo.get("categories", [])
            if isinstance(file, str) and isinstance(photo_categories, list):
                categories[(roll_id, file)] = photo_categories.copy()

    return categories


def main() -> None:
    existing_categories = load_existing_categories()
    roll_dirs = sorted(
        (
            path
            for path in IMAGES_DIR.iterdir()
            if path.is_dir()
            and path.name != THUMBNAILS_DIR.name
            and not path.name.startswith(".")
        ),
        key=lambda path: (roll_number(path.name), natural_key(path.name)),
    )

    rolls = []
    photo_count = 0
    generation_jobs: list[tuple[str, Path, Path]] = []
    expected_thumbnails: set[Path] = set()
    expected_web_images: set[Path] = set()

    for roll_dir in roll_dirs:
        photos = []
        sources = image_files(roll_dir)
        if not sources:
            continue
        stem_counts = Counter(
            source.relative_to(roll_dir).with_suffix("").as_posix().casefold()
            for source in sources
        )

        for source in sources:
            relative_source = source.relative_to(roll_dir)
            relative_stem = relative_source.with_suffix("")
            normalized_stem = relative_stem.as_posix().casefold()
            if stem_counts[normalized_stem] > 1:
                extension = source.suffix.casefold().lstrip(".")
                relative_stem = relative_stem.with_name(
                    f"{relative_stem.name}_{extension}"
                )

            thumbnail = (
                THUMBNAILS_DIR / roll_dir.name / relative_stem
            ).with_suffix(".webp")
            expected_thumbnails.add(thumbnail)
            if not is_current_image(source, thumbnail):
                generation_jobs.append(("thumbnail", source, thumbnail))

            web_image = (
                WEB_IMAGES_DIR / roll_dir.name / relative_stem
            ).with_suffix(".webp")
            expected_web_images.add(web_image)
            if not is_current_image(source, web_image):
                generation_jobs.append(("web image", source, web_image))

            photos.append(
                {
                    "file": relative_stem.as_posix(),
                    "categories": existing_categories.get(
                        (roll_dir.name, relative_stem.as_posix()), []
                    ),
                }
            )

        roll = {
            "id": roll_dir.name,
            "name": roll_label(roll_dir.name),
            "sortOrder": roll_number(roll_dir.name),
            "rollCount": LOGICAL_ROLL_COUNTS.get(roll_dir.name, 1),
            "photos": photos,
        }
        if roll_dir.name in ROLL_HEROES:
            hero = ROLL_HEROES[roll_dir.name]
            if hero not in {photo["file"] for photo in photos}:
                raise ValueError(
                    f"Hero photo {hero!r} does not exist in roll {roll_dir.name!r}."
                )
            roll["hero"] = hero
        rolls.append(roll)
        photo_count += len(photos)

    generated_counts: Counter[str] = Counter()
    if generation_jobs:
        with ProcessPoolExecutor(max_workers=8) as executor:
            generated_counts.update(executor.map(generate_asset, generation_jobs))

    removed_thumbnails = prune_generated_assets(THUMBNAILS_DIR, expected_thumbnails)
    removed_web_images = prune_generated_assets(WEB_IMAGES_DIR, expected_web_images)

    archive = {"categories": CATEGORIES, "rolls": rolls}
    DATA_FILE.write_text(
        DATA_PREFIX
        + json.dumps(archive, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Archive contains {len(rolls)} rolls and {photo_count} photos.")
    print(f"Generated or refreshed {generated_counts['thumbnail']} thumbnails.")
    print(f"Generated or refreshed {generated_counts['web image']} web images.")
    print(f"Removed {removed_thumbnails} obsolete thumbnails.")
    print(f"Removed {removed_web_images} obsolete web images.")


if __name__ == "__main__":
    main()
