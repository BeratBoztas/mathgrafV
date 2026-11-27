import math
from services.parser_service import guvenli_degerlendir


def gorunum_penceresi_hesapla(meta: dict, sabit_deger, aci_birimi: str) -> dict:
    """Her turlu fonksiyon icin en uygun X-Y eksen sinirlarini otomatik belirler."""
    if meta.get("hasTrig") and aci_birimi == "DEG":
        return {"xMin": -180, "xMax": 180, "yMin": -6, "yMax": 6}
    if meta.get("hasTrig") and aci_birimi == "RAD":
        return {"xMin": -10, "xMax": 10, "yMin": -5, "yMax": 5}
    if meta.get("simplePower") and sabit_deger is not None:
        x_odak = meta["simplePower"]["exp"]
        x_aralik = max(6, abs(x_odak) * 2.5)
        y_bosluk = max(4, abs(sabit_deger) * 0.35)
        return {
            "xMin": min(-4, x_odak - x_aralik),
            "xMax": max(6, x_odak + x_aralik),
            "yMin": min(-2, sabit_deger - y_bosluk),
            "yMax": max(sabit_deger + y_bosluk, 4),
        }
    if sabit_deger is not None and math.isfinite(sabit_deger):
        aralik = max(5, abs(sabit_deger) * 0.5)
        return {"xMin": -10, "xMax": 10, "yMin": sabit_deger - aralik, "yMax": sabit_deger + aralik}
    return {"xMin": -10, "xMax": 10, "yMin": -8, "yMax": 8}
# Yukaridaki fonksiyon, cizilecek fonksiyonun turune gore (trigonometri, uslu sayi,
# sabit veya genel fonksiyon) baslangic X-Y pencere sinirlarini belirler.


def grafik_noktalari_uret(agac, x_min: float, x_max: float, aci_birimi: str, ornek_sayisi: int = 420):
    """Belirtilen x araliginda [x, y] nokta listesi uretir; asimptotlarda None birakir."""
    noktalar = []
    adim = (x_max - x_min) / max(1, ornek_sayisi)
    for i in range(ornek_sayisi + 1):
        x = x_min + i * adim
        try:
            y = guvenli_degerlendir(agac, x, aci_birimi)
        except Exception:
            y = math.nan
        if math.isfinite(y) and abs(y) < 1e6:
            noktalar.append([round(x, 4), round(y, 4)])
        else:
            noktalar.append([round(x, 4), None])
    return noktalar
# Yukaridaki fonksiyon, X-Y duzleminde cizilecek egri icin esit aralikli noktalar
# uretir. Tanimsiz veya asimptot noktalarinda None dondurerek cizginin kopmasini saglar.
