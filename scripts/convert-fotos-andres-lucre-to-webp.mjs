/**
 * Convierte imágenes PNG/JPEG/JPG en public/fotosAndres&Lucre a WebP.
 * Uso: node scripts/convert-fotos-andres-lucre-to-webp.mjs
 * Requiere: pnpm add -D sharp (o npm install -D sharp)
 */

import { readdir, stat } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const FOLDER_NAME = "fotosAndres&Lucre";
const IMG_DIR = join(ROOT, "public", FOLDER_NAME);

const CONVERT_EXTS = [".png", ".jpeg", ".jpg"];

async function convertToWebp() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "Error: sharp no está instalado. Ejecutá: npm install --save-dev sharp"
    );
    process.exit(1);
  }

  let files;
  try {
    files = await readdir(IMG_DIR);
  } catch (err) {
    console.error("No se pudo leer la carpeta:", IMG_DIR, err.message);
    process.exit(1);
  }

  const toConvert = files.filter((f) =>
    CONVERT_EXTS.includes(extname(f).toLowerCase())
  );

  if (toConvert.length === 0) {
    console.log("No hay archivos PNG/JPEG para convertir en", FOLDER_NAME);
    return;
  }

  console.log("Convirtiendo a WebP:", toConvert.join(", "));

  for (const file of toConvert) {
    const inputPath = join(IMG_DIR, file);
    const base = file.replace(/\.[^.]+$/i, "");
    const outputPath = join(IMG_DIR, `${base}.webp`);

    try {
      const info = await stat(inputPath);
      if (!info.isFile()) continue;

      await sharp(inputPath).webp({ quality: 85 }).toFile(outputPath);
      console.log("  OK:", file, "->", `${base}.webp`);
    } catch (err) {
      console.error("  Error con", file, err.message);
    }
  }

  console.log("Listo. Actualizá las rutas en app/bodaAndres&Lucre/page.tsx a .webp");
}

convertToWebp();
