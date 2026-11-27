import ast
import math
from flask import Blueprint, jsonify, render_template, request
from config import Config
from services.calculus_service import integral_coz, turev_coz
from services.graph_service import gorunum_penceresi_hesapla, grafik_noktalari_uret
from services.parser_service import (
    agaci_incele,
    aralik_ayir,
    guvenli_degerlendir,
    turkce_ifadeyi_duzenle,
)

math_bp = Blueprint("math_bp", __name__)
# Flask Blueprint yapisi ile tum web ve API rotalari ayri bir katmanda toplanir.


@math_bp.route("/")
def ana_sayfa():
    """Kullanici siteye girdiginde ana HTML arayuzunu gosterir."""
    return render_template("index.html")


@math_bp.route("/api/saglik", methods=["GET"])
def saglik_kontrolu():
    """Bulut sunucularin sitenin ayakta oldugunu anlamasi icin saglik uc noktasi."""
    return jsonify({"ok": True, "service": "MatGraf Python API"})


@math_bp.route("/api/hesapla", methods=["POST"])
def api_hesapla():
    """Genel islemleri, aralikli grafikleri (<, >) ve ozel degiskenleri (a, b vb.) cozer."""
    veri = request.get_json(silent=True) or {}
    ham_ifade = (veri.get("expression") or "").strip()
    aci_birimi = veri.get("angleUnit", Config.DEFAULT_ANGLE_UNIT)
    zorla_grafik = bool(veri.get("forceGraph", False))
    degiskenler = veri.get("variables") or {}

    if not ham_ifade or len(ham_ifade) > Config.MAX_EXPRESSION_LENGTH:
        return jsonify({"ok": False, "error": "Lütfen geçerli bir matematik ifadesi yazın."}), 400

    try:
        temiz_ifade, aralik = aralik_ayir(ham_ifade)
        if not temiz_ifade and aralik:
            return jsonify({"ok": True, "mode": "graph", "domain": aralik, "normalized": ham_ifade})
        py_ifade, gorunen, acik_grafik = turkce_ifadeyi_duzenle(temiz_ifade)
        agac = ast.parse(py_ifade, mode="eval")
        meta = agaci_incele(agac, degiskenler)
    except Exception as hata:
        return jsonify({"ok": False, "error": f"İfade anlaşılamadı: {hata}"}), 400

    grafik_cizilsin = zorla_grafik or acik_grafik or bool(aralik) or meta["hasX"] or meta["hasPower"] or meta["hasFn"]
    sabit_deger = None

    if not meta["hasX"]:
        try:
            sabit_deger = guvenli_degerlendir(agac, 0.0, aci_birimi, degiskenler)
        except Exception as hata:
            return jsonify({"ok": False, "error": str(hata)}), 400
        if not math.isfinite(sabit_deger):
            return jsonify({"ok": False, "error": "İşlem sonucu tanımsız (örneğin sıfıra bölme)."}), 400

    gorunum = gorunum_penceresi_hesapla(meta, sabit_deger, aci_birimi)
    noktalar = (
        grafik_noktalari_uret(agac, gorunum["xMin"], gorunum["xMax"], aci_birimi, Config.DEFAULT_SAMPLE_COUNT)
        if grafik_cizilsin and not degiskenler
        else []
    )

    return jsonify({
        "ok": True,
        "mode": "graph" if grafik_cizilsin else "arithmetic",
        "normalized": gorunen,
        "constVal": sabit_deger,
        "domain": aralik,
        "hasX": meta["hasX"],
        "hasTrig": meta["hasTrig"],
        "simplePower": meta["simplePower"],
        "view": gorunum,
        "samplePoints": noktalar,
    })
# Yukaridaki /api/hesapla rotasi; gelen ifadede aralik (<, >) veya ozel degiskenler varsa
# bunlari da isleyerek JSON yaniti olarak on yuze gonderir.


@math_bp.route("/api/turev", methods=["POST"])
def api_turev():
    """On yuzden gelen fonksiyonun turevini (d/dx) hesaplar."""
    veri = request.get_json(silent=True) or {}
    ham_ifade = (veri.get("expression") or "").strip()
    x_noktasi = veri.get("xPoint")
    if not ham_ifade:
        return jsonify({"ok": False, "error": "Türev almak için bir fonksiyon yazın."}), 400
    try:
        sonuc = turev_coz(ham_ifade, x_noktasi)
        return jsonify({"ok": True, **sonuc})
    except Exception as hata:
        return jsonify({"ok": False, "error": f"Türev hesaplanamadı: {hata}"}), 400


@math_bp.route("/api/integral", methods=["POST"])
def api_integral():
    """On yuzden gelen fonksiyonun belirsiz veya belirli integralini hesaplar."""
    veri = request.get_json(silent=True) or {}
    ham_ifade = (veri.get("expression") or "").strip()
    alt_sinir = veri.get("lowerBound")
    ust_sinir = veri.get("upperBound")
    if not ham_ifade:
        return jsonify({"ok": False, "error": "İntegral almak için bir fonksiyon yazın."}), 400
    try:
        sonuc = integral_coz(ham_ifade, alt_sinir, ust_sinir)
        return jsonify({"ok": True, **sonuc})
    except Exception as hata:
        return jsonify({"ok": False, "error": f"İntegral hesaplanamadı: {hata}"}), 400
