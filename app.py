from flask import Flask
from flask_cors import CORS
from config import Config
from routes.math_routes import math_bp


def create_app():
    """Flask uygulamasini fabrika (Factory) deseni ile olusturur."""
    uygulama = Flask(__name__, template_folder="templates", static_folder="static")
    uygulama.config.from_object(Config)

    # Farkli cihaz ve tarayicilardan guvenli API erisimi icin CORS acilir
    CORS(uygulama)

    # Matematik, turev, integral ve grafik rotalarini uygulamaya bagla
    uygulama.register_blueprint(math_bp)
    return uygulama
# Yukaridaki create_app fonksiyonu, projenin giris kapisidir. Ayarlari config.py
# dosyasindan alir, CORS destegini acar ve routes/math_routes.py dosyasindaki
# tum API uc noktalarini uygulamaya kaydeder.


app = create_app()
# Bulut sunucular (Gunicorn / Render / Railway) bu "app" nesnesini dogrudan calistirir.


if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
# Dosya bilgisayarda "python app.py" ile calistirildiginda yerel sunucuyu baslatir.
