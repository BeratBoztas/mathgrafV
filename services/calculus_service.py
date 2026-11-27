import ast
import math
from services.parser_service import guvenli_degerlendir, turkce_ifadeyi_duzenle

try:
    import sympy as sp
    SYMPY_MEVCUT = True
except ImportError:
    SYMPY_MEVCUT = False
# Yukaridaki blokta sembolik turev ve integral icin SymPy kutuphanesi yuklenir.
# Eger SymPy kurulu degilse sistem cokmez; asagidaki sayisal yedek motor devreye girer.


def _sympy_ifadesi_olustur(py_ifade: str):
    """Python ifadesini SymPy sembolik nesnesine donusturur."""
    x = sp.Symbol("x")
    yerel = {
        "x": x,
        "pi": sp.pi,
        "e": sp.E,
        "sin": sp.sin,
        "cos": sp.cos,
        "tan": sp.tan,
        "cot": sp.cot,
        "sec": sp.sec,
        "csc": sp.csc,
        "asin": sp.asin,
        "acos": sp.acos,
        "atan": sp.atan,
        "arcsin": sp.asin,
        "arccos": sp.acos,
        "arctan": sp.atan,
        "sqrt": sp.sqrt,
        "abs": sp.Abs,
        "ln": sp.log,
        "log": lambda v: sp.log(v, 10),
        "exp": sp.exp,
        "sinh": sp.sinh,
        "cosh": sp.cosh,
        "tanh": sp.tanh,
    }
    return x, sp.sympify(py_ifade, locals=yerel)
# Yukaridaki yardimci fonksiyon, temizlenmis matematik ifadesini SymPy kutuphanesinin
# sembolik olarak turev ve integral alabilecegi bir ifadeye cevirir.


def turev_coz(ham_ifade: str, x_noktasi=None):
    """Verilen fonksiyonun sembolik turevini (d/dx) ve istege bagli nokta degerini hesaplar."""
    py_ifade, gorunen, _ = turkce_ifadeyi_duzenle(ham_ifade)
    agac = ast.parse(py_ifade, mode="eval")

    turev_metni = None
    if SYMPY_MEVCUT:
        try:
            x, expr = _sympy_ifadesi_olustur(py_ifade)
            turev_expr = sp.simplify(sp.diff(expr, x))
            turev_metni = str(turev_expr).replace("**", "^")
        except Exception:
            turev_metni = None

    nokta_degeri = None
    if x_noktasi is not None:
        h = 1e-5
        xv = float(x_noktasi)
        f1 = guvenli_degerlendir(agac, xv + h, "RAD")
        f2 = guvenli_degerlendir(agac, xv - h, "RAD")
        if math.isfinite(f1) and math.isfinite(f2):
            nokta_degeri = round((f1 - f2) / (2.0 * h), 6)

    return {
        "original": gorunen,
        "derivative": turev_metni or f"d/dx({gorunen})",
        "atPoint": nokta_degeri,
    }
# Yukaridaki turev_coz fonksiyonu, d/dx(f(x)) sembolik turevini bulur.
# Kullanici belirli bir x noktasi verirse merkezi fark yontemiyle egimi de hesaplar.


def integral_coz(ham_ifade: str, alt_sinir=None, ust_sinir=None):
    """Belirsiz integral (+ C) veya [a, b] araliginda belirli integral alanini hesaplar."""
    py_ifade, gorunen, _ = turkce_ifadeyi_duzenle(ham_ifade)
    agac = ast.parse(py_ifade, mode="eval")

    belirsiz_metin = None
    if SYMPY_MEVCUT:
        try:
            x, expr = _sympy_ifadesi_olustur(py_ifade)
            int_expr = sp.integrate(expr, x)
            if not isinstance(int_expr, sp.Integral):
                belirsiz_metin = str(int_expr).replace("**", "^") + " + C"
        except Exception:
            belirsiz_metin = None

    belirli_sonuc = None
    if alt_sinir is not None and ust_sinir is not None:
        a = float(alt_sinir)
        b = float(ust_sinir)
        n = 400
        h = (b - a) / n
        toplam = 0.0
        for i in range(n + 1):
            xi = a + i * h
            yi = guvenli_degerlendir(agac, xi, "RAD")
            if not math.isfinite(yi):
                yi = 0.0
            katsayi = 1 if (i == 0 or i == n) else (4 if i % 2 == 1 else 2)
            toplam += katsayi * yi
        belirli_sonuc = round((h / 3.0) * toplam, 6)

    return {
        "original": gorunen,
        "indefinite": belirsiz_metin or f"∫({gorunen}) dx",
        "definite": belirli_sonuc,
        "bounds": [alt_sinir, ust_sinir] if (alt_sinir is not None and ust_sinir is not None) else None,
    }
# Yukaridaki integral_coz fonksiyonu; belirsiz integrallerde sembolik antiturev (+ C)
# uretir, alt ve ust sinir [a, b] verildiginde ise Simpson kurali ile egri altindaki
# kesin alani hesaplar.
