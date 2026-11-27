import ast
import math
import operator
import re

IKILI_OPERATORLER = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}

TEKLI_OPERATORLER = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

TRIG_FONKSIYONLARI = {
    "sin", "cos", "tan", "cot", "sec", "csc",
    "asin", "acos", "atan", "arcsin", "arccos", "arctan",
}

TUM_FONKSIYONLAR = TRIG_FONKSIYONLARI | {
    "sqrt", "cbrt", "abs", "ln", "log", "exp",
    "floor", "ceil", "sinh", "cosh", "tanh",
}
# Yukaridaki sozluk ve kumeler, Python backend tarafinda izin verilen guvenli
# matematik operatorlerini ve fonksiyon isimlerini tanimlar.


def aralik_ayir(ham_metin: str):
    """Ifade icindeki <, >, <=, >= aralik kosullarini ayirir."""
    metin = (ham_metin or "").strip()
    kosul = None

    # { -2 < x < 5 } veya [ x > 0 ] veya dogrudan ifade sonundaki araliklar
    cift = re.search(
        r"[\{\[\s]?\s*([+-]?\d+(?:\.\d+)?)\s*(<=|<)\s*x\s*(<=|<)\s*([+-]?\d+(?:\.\d+)?)\s*[\}\]]?",
        metin,
        re.I,
    )
    if cift:
        kosul = {
            "min": float(cift.group(1)),
            "minInc": cift.group(2) == "<=",
            "max": float(cift.group(4)),
            "maxInc": cift.group(3) == "<=",
        }
        metin = (metin[: cift.start()] + " " + metin[cift.end() :]).strip()
        return metin, kosul

    tek = re.search(
        r"[\{\[\s]?\s*x\s*(<=|>=|<|>)\s*([+-]?\d+(?:\.\d+)?)\s*[\}\]]?",
        metin,
        re.I,
    )
    if tek:
        op = tek.group(1)
        val = float(tek.group(2))
        if op in (">", ">="):
            kosul = {"min": val, "minInc": op == ">=", "max": None, "maxInc": False}
        else:
            kosul = {"min": None, "minInc": False, "max": val, "maxInc": op == "<="}
        metin = (metin[: tek.start()] + " " + metin[tek.end() :]).strip()
        return metin, kosul

    return metin, None
# Yukaridaki fonksiyon, grafik ifadesindeki < veya > aralik sinirlarini ayiklayarak
# sadece istenen x araliginin cizilmesini saglar.


def turkce_ifadeyi_duzenle(ham_metin: str):
    """Turkce ifadeleri standart Python matematik sozdizimine cevirir."""
    metin = (ham_metin or "").strip()
    metin = metin.replace("İ", "i").replace("I", "ı").lower()

    metin = (
        metin.replace("²", "^2")
        .replace("³", "^3")
        .replace("ⁿ", "^n")
        .replace("√", "sqrt")
        .replace("π", "pi")
        .replace("×", "*")
        .replace("·", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace("–", "-")
        .replace("°", "")
    )
    metin = re.sub(r"\|([^|]+)\|", r"abs(\1)", metin)
    metin = metin.translate(str.maketrans("çğıöşü", "cgiosu"))

    acik_grafik = bool(re.search(r"\b(grafigi|grafigini|grafik|ciz)\b", metin))
    metin = re.sub(r"^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*", "", metin)
    metin = re.sub(
        r"\b(grafigini|grafigi|grafik|ciz|goster|hesapla|kactir|nedir|sonucu|lutfen|esittir)\b",
        " ",
        metin,
    )
    metin = re.sub(r"(\d),(\d)", r"\1.\2", metin)

    metin = re.sub(r"\b(uzeri|ussu|kuvveti)\b", "**", metin)
    metin = re.sub(r"\bkaresi\b", "**2", metin)
    metin = re.sub(r"\bkupu\b", "**3", metin)
    metin = re.sub(r"\b(karekok|kok)\b", "sqrt", metin)
    metin = re.sub(r"\b(arti|topla)\b", "+", metin)
    metin = re.sub(r"\b(eksi|cikar)\b", "-", metin)
    metin = re.sub(r"\b(carpi|kere|defa)\b", "*", metin)
    metin = re.sub(r"\bbolu\b", "/", metin)
    metin = metin.replace("^", "**")
    metin = re.sub(r"\s+", " ", metin).strip()

    fn_liste = "|".join(sorted(TUM_FONKSIYONLAR, key=len, reverse=True))
    metin = re.sub(rf"\b({fn_liste})\s+([0-9.]+|[a-z])\b", r"\1(\2)", metin)
    metin = re.sub(rf"(\d)\s*([a-z]|\(|{fn_liste})", r"\1*\2", metin)
    metin = re.sub(r"(\))\s*(\d|[a-z]|\()", r"\1*\2", metin)
    metin = re.sub(r"\b([a-z])\s*(\()", r"\1*\2", metin)

    gorunen = metin.replace("**", "^")
    return metin, gorunen, acik_grafik
# Yukaridaki fonksiyon, Turkce ifadeleri ve ozel sembolleri Python ast modulunun
# okuyabilecegi temiz matematik sozdizimine cevirir.


def guvenli_degerlendir(dugum, x_degeri: float, aci_birimi: str = "DEG", degiskenler=None) -> float:
    """AST agacini eval kullanmadan ve ozel degiskenleri (a, b, k vb.) tanıyarak hesaplar."""
    radyana = math.pi / 180.0 if aci_birimi == "DEG" else 1.0
    dereceye = 180.0 / math.pi if aci_birimi == "DEG" else 1.0
    deg = degiskenler or {}

    if isinstance(dugum, ast.Expression):
        return guvenli_degerlendir(dugum.body, x_degeri, aci_birimi, deg)

    if isinstance(dugum, ast.Constant) and isinstance(dugum.value, (int, float)):
        return float(dugum.value)

    if isinstance(dugum, ast.Name):
        ad = dugum.id.lower()
        if ad == "x":
            return float(x_degeri)
        if ad == "pi":
            return math.pi
        if ad == "e":
            return math.e
        if ad in deg:
            return float(deg[ad])
        raise ValueError(f'Bilinmeyen değişken: "{dugum.id}"')

    if isinstance(dugum, ast.UnaryOp) and type(dugum.op) in TEKLI_OPERATORLER:
        return TEKLI_OPERATORLER[type(dugum.op)](
            guvenli_degerlendir(dugum.operand, x_degeri, aci_birimi, deg)
        )

    if isinstance(dugum, ast.BinOp) and type(dugum.op) in IKILI_OPERATORLER:
        sol = guvenli_degerlendir(dugum.left, x_degeri, aci_birimi, deg)
        sag = guvenli_degerlendir(dugum.right, x_degeri, aci_birimi, deg)
        if isinstance(dugum.op, ast.Div) and sag == 0:
            return math.nan
        if isinstance(dugum.op, ast.Pow):
            if abs(sag) > 500:
                return math.nan
            if sol < 0 and not float(sag).is_integer():
                return math.nan
        return IKILI_OPERATORLER[type(dugum.op)](sol, sag)

    if isinstance(dugum, ast.Call) and isinstance(dugum.func, ast.Name):
        fonk = dugum.func.id.lower()
        if fonk not in TUM_FONKSIYONLAR or len(dugum.args) != 1:
            raise ValueError(f'Desteklenmeyen fonksiyon: "{fonk}"')
        a = guvenli_degerlendir(dugum.args[0], x_degeri, aci_birimi, deg)
        if not math.isfinite(a):
            return math.nan

        if fonk == "sin":
            return math.sin(a * radyana)
        if fonk == "cos":
            return math.cos(a * radyana)
        if fonk == "tan":
            rad = a * radyana
            c = math.cos(rad)
            return math.nan if abs(c) < 1e-10 else math.sin(rad) / c
        if fonk == "cot":
            rad = a * radyana
            s = math.sin(rad)
            return math.nan if abs(s) < 1e-10 else math.cos(rad) / s
        if fonk == "sec":
            c = math.cos(a * radyana)
            return math.nan if abs(c) < 1e-10 else 1.0 / c
        if fonk == "csc":
            s = math.sin(a * radyana)
            return math.nan if abs(s) < 1e-10 else 1.0 / s
        if fonk in ("asin", "arcsin"):
            return math.asin(a) * dereceye if -1 <= a <= 1 else math.nan
        if fonk in ("acos", "arccos"):
            return math.acos(a) * dereceye if -1 <= a <= 1 else math.nan
        if fonk in ("atan", "arctan"):
            return math.atan(a) * dereceye
        if fonk == "sqrt":
            return math.sqrt(a) if a >= 0 else math.nan
        if fonk == "cbrt":
            return math.copysign(abs(a) ** (1.0 / 3.0), a)
        if fonk == "abs":
            return abs(a)
        if fonk == "ln":
            return math.log(a) if a > 0 else math.nan
        if fonk == "log":
            return math.log10(a) if a > 0 else math.nan
        if fonk == "exp":
            return math.exp(a) if a < 700 else math.nan
        if fonk == "sinh":
            return math.sinh(a) if abs(a) < 700 else math.nan
        if fonk == "cosh":
            return math.cosh(a) if abs(a) < 700 else math.nan
        if fonk == "tanh":
            return math.tanh(a)
        if fonk == "floor":
            return float(math.floor(a))
        if fonk == "ceil":
            return float(math.ceil(a))

    raise ValueError("İfade çözümlenemedi. Lütfen yazımı kontrol edin.")
# Yukaridaki fonksiyon, AST agacini yururken kullanicinin atadigi ozel degiskenleri
# (a, b, k vb.) de okuyarak guvenli bicimde sayisal degeri hesaplar.


def agaci_incele(agac, degiskenler=None):
    """Ifadenin grafik mi yoksa sadece dort islem mi oldugunu analiz eder."""
    x_var = False
    us_var = False
    trig_var = False
    fonk_var = False

    for dugum in ast.walk(agac):
        if isinstance(dugum, ast.Name) and dugum.id.lower() == "x":
            x_var = True
        elif isinstance(dugum, ast.BinOp) and isinstance(dugum.op, ast.Pow):
            us_var = True
        elif isinstance(dugum, ast.Call) and isinstance(dugum.func, ast.Name):
            fonk_var = True
            if dugum.func.id.lower() in TRIG_FONKSIYONLARI:
                trig_var = True

    basit_us = None
    if not x_var and isinstance(agac.body, ast.BinOp) and isinstance(agac.body.op, ast.Pow):
        taban = guvenli_degerlendir(agac.body.left, 0.0, "DEG", degiskenler)
        us = guvenli_degerlendir(agac.body.right, 0.0, "DEG", degiskenler)
        if math.isfinite(taban) and math.isfinite(us) and taban > 0 and taban != 1:
            basit_us = {"base": taban, "exp": us}

    return {
        "hasX": x_var,
        "hasPower": us_var,
        "hasTrig": trig_var,
        "hasFn": fonk_var,
        "simplePower": basit_us,
    }
# Yukaridaki fonksiyon ifadenin turunu analiz eder ve basit uslu sayilari tespit eder.
