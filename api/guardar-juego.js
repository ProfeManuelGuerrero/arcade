import fs from 'fs';
import path from 'path';

export const config = {
    api: { bodyParser: { sizeLimit: '10mb' } } // Permite imágenes pesadas de los estudiantes
};

export default async function handler(req, res) {
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
        const rutaUploads = path.join(process.cwd(), 'uploads');
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
        console.error(error);
        return res.status(500).json({ error: 'Error interno en el circuito del servidor' });
    }
}
