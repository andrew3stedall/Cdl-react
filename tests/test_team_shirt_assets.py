from pathlib import Path

SHIRT_DIR = Path("frontend/public/team-shirts")
EXPECTED_SHIRTS = {
    "ars.svg",
    "avl.svg",
    "bha.svg",
    "bou.svg",
    "bre.svg",
    "che.svg",
    "cov.svg",
    "cry.svg",
    "eve.svg",
    "ful.svg",
    "hul.svg",
    "ips.svg",
    "lee.svg",
    "liv.svg",
    "mci.svg",
    "mun.svg",
    "new.svg",
    "nfo.svg",
    "sun.svg",
    "tot.svg",
    "unknown.svg",
    "whu.svg",
    "wol.svg",
}


def test_team_shirt_asset_set_is_complete() -> None:
    assert {path.name for path in SHIRT_DIR.glob("*.svg")} == EXPECTED_SHIRTS


def test_team_shirt_assets_are_valid_svg_xml() -> None:
    from xml.etree import ElementTree

    for path in sorted(SHIRT_DIR.glob("*.svg")):
        root = ElementTree.fromstring(path.read_text(encoding="utf-8"))  # noqa: S314
        assert root.tag == "{http://www.w3.org/2000/svg}svg", path
        assert root.find("{http://www.w3.org/2000/svg}title") is not None, path
