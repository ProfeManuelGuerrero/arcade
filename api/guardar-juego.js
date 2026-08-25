import fs from 'fs';
import path from 'path';

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

        // 2. Procesar y guardar la imagen físicamente en el servidor de Vercel
        // Guardar en la carpeta `public/uploads` para que las imágenes sean accesibles
        const rutaUploads = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(rutaUploads)) {
            fs.mkdirSync(rutaUploads, { recursive: true });
        }

        const nombreUnico = `${Date.now()}_${nombreImagen.replace(/\s+/g, '_')}`;
        const rutaImagenFinal = path.join(rutaUploads, nombreUnico);
        
        // Convertir el string base64 que envía el navegador de vuelta a un archivo de imagen real
        const datosLimpio = imagenBase64.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(rutaImagenFinal, Buffer.from(datosLimpio, 'base64'));

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
            urlImagen: `/uploads/${nombreUnico}`,
            fecha: new Date().toISOString()
        };

        listaJuegos.unshift(nuevoJuego); // Añadir al inicio para que aparezca primero
        fs.writeFileSync(rutaJson, JSON.stringify(listaJuegos, null, 2));

        return res.status(200).json({ success: true, mensaje: 'Juego integrado al servidor con éxito' });

    } catch (error) {
        console.error('Error en api/guardar-juego:', error);
        // Devolver el mensaje de error para facilitar depuración en entorno controlado
        return res.status(500).json({ error: error.message || 'Error interno en el circuito del servidor' });
    }
}
