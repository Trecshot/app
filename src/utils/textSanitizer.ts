/**
 * Utilidad de sanitización y limpieza de texto para notas tácticas,
 * objetivos de mesociclo y comentarios de entrenamiento.
 *
 * Convierte comandos LaTeX comunes de peso, repeticiones y matemáticas
 * en texto plano limpio y legible para React Native sin requerir librerías pesadas.
 *
 * Ejemplos:
 * - "100\\text{ kg} \\times 6" -> "100 kg × 6"
 * - "$90\\text{ kg}$ serie top" -> "90 kg serie top"
 * - "RIR 1-2 en 80\\text{kg}\\times 3" -> "RIR 1-2 en 80kg × 3"
 */
export function sanitizeTacticalNote(input: string | null | undefined): string {
  if (!input) return '';

  return input
    // 1. Elimina delimitadores de fórmulas matemáticas ($...$ o $$...$$)
    .replace(/\${1,2}/g, '')

    // 2. Transforma comandos \text{...}, \mathrm{...}, \mathbf{...}, etc. dejando solo el contenido interior
    .replace(/\\(text|mathrm|mathbf|textbf|textit|bold)\{([^}]+)\}/g, '$2')

    // 3. Reemplaza el operador de multiplicación \times por el símbolo estándar '×'
    .replace(/\s*\\times\s*/g, ' × ')

    // 4. Reemplaza otros operadores matemáticos comunes
    .replace(/\s*\\cdot\s*/g, ' · ')
    .replace(/\s*\\pm\s*/g, ' ± ')
    .replace(/\s*\\approx\s*/g, ' ≈ ')
    .replace(/\s*\\(leq|le)\s*/g, ' ≤ ')
    .replace(/\s*\\(geq|ge)\s*/g, ' ≥ ')
    .replace(/\s*\\(rightarrow|to)\s*/g, ' → ')

    // 5. Elimina barras invertidas sobrantes de comandos no identificados
    .replace(/\\[a-zA-Z]+/g, '')

    // 6. Elimina llaves huérfanas que pudieran haber quedado
    .replace(/[{}]/g, '')

    // 7. Colapsa espacios múltiples y limpia saltos vacíos
    .replace(/[ \t]+/g, ' ')
    .trim();
}
