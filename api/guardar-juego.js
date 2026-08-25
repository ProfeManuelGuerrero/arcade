import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

export const config = {
    api: { bodyParser: { sizeLimit: '10mb' } } // Permite imágenes pesadas de los estudiantes
};

export default async function handler(req, res) {
    console.log('api/guardar-juego invoked, method:', req.method);

    // Soportar preflight CORS y depuración cuando sea necesario
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { contrasena, titulo, badge, urlJuego, imagenBase64, nombreImagen } = req.body;

        // 1. Validación de seguridad básica para el profesor
        if (contrasena !== 'ArcadeProfesor2026') {
            return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }

        // 2. Procesar la imagen. Si tienes Cloudinary configurado, subimos allí.
        const datosLimpio = imagenBase64.replace(/^data:image\/\w+;base64,/, "");
        const bufferImagen = Buffer.from(datosLimpio, 'base64');

        let urlImagenPublica = null;

        // Si hay configuración de Cloudinary en variables de entorno, usarla
        if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });

            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({ folder: 'arcade' }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
                stream.end(bufferImagen);
            });

            urlImagenPublica = uploadResult.secure_url;
        } else {
            // Intentar guardar en `public/uploads` — NOTA: en Vercel esto fallará porque
            // el filesystem de despliegue es de solo lectura (/var/task). Pero localmente funciona.
            try {
                const rutaUploads = path.join(process.cwd(), 'public', 'uploads');
                if (!fs.existsSync(rutaUploads)) {
                    fs.mkdirSync(rutaUploads, { recursive: true });
                }

                const nombreUnico = `${Date.now()}_${nombreImagen.replace(/\s+/g, '_')}`;
                const rutaImagenFinal = path.join(rutaUploads, nombreUnico);
                fs.writeFileSync(rutaImagenFinal, bufferImagen);
                urlImagenPublica = `/uploads/${nombreUnico}`;
            } catch (fsErr) {
                console.error('No se pudo escribir la imagen en disco:', fsErr);
                // No hacemos throw aquí, porque preferimos responder con información util.
                urlImagenPublica = null;
            }
        }

        // 3. Leer, actualizar y guardar el archivo JSON de juegos
        const rutaJson = path.join(process.cwd(), 'data', 'juegos.json');
        let listaJuegos = [];

        if (fs.existsSync(rutaJson)) {
            const contenido = fs.readFileSync(rutaJson, 'utf-8');
            listaJuegos = JSON.parse(contenido || '[]');
        }

        const nuevoJuego = {
            id: Date.now(),
            titulo,
            badge: badge.toUpperCase(),
            urlJuego,
            urlImagen: urlImagenPublica, // puede ser URL externa o null
            fecha: new Date().toISOString()
        };

        listaJuegos.unshift(nuevoJuego); // Añadir al inicio para que aparezca primero

        // Intentar escribir el JSON de juegos. En Vercel esto también puede fallar.
        try {
            fs.writeFileSync(rutaJson, JSON.stringify(listaJuegos, null, 2));
        } catch (jsonErr) {
            console.error('No se pudo actualizar data/juegos.json:', jsonErr);
            // Respondemos con éxito parcial y el objeto `nuevoJuego` para que el cliente lo muestre.
            return res.status(200).json({
                success: true,
                mensaje: 'Imagen subida, pero no se pudo actualizar el archivo JSON en el servidor (entorno serverless).',
                juego: nuevoJuego
            });
        }

        return res.status(200).json({ success: true, mensaje: 'Juego integrado al servidor con éxito', juego: nuevoJuego });

    } catch (error) {
        console.error('Error en api/guardar-juego:', error);
        // Devolver el mensaje de error para facilitar depuración en entorno controlado
        return res.status(500).json({ error: error.message || 'Error interno en el circuito del servidor' });
    }
}
