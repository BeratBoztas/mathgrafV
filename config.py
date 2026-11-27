import os


class Config:
    HOST = "0.0.0.0"
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    DEFAULT_ANGLE_UNIT = "DEG"
    DEFAULT_SAMPLE_COUNT = 420
    MAX_EXPRESSION_LENGTH = 300
# Yukaridaki Config sinifi; sunucu adresi, port numarasi, varsayilan aci birimi
# ve grafik nokta sayisi gibi temel ayarlari tek bir dosyada toplar.
# Bulut sunucularinda PORT ortami otomatik okunur, yerel bilgisayarda 5000 kullanilir.
