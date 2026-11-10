#!/bin/bash
# Quick Restore Workflow for PECOD V2→V3
# Usage: bash quick-restore.sh [--dry-run] [--backup-only]

set -e

BACKUP_DIR="backend/backups"
SCRIPT_PATH="backend/scripts/restore-v2-data.ts"

echo "🔄 PECOD V2→V3 Data Restoration Workflow"
echo "========================================"
echo ""

# Parse arguments
DRY_RUN=false
BACKUP_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup-only)
            BACKUP_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--backup-only]"
            exit 1
            ;;
    esac
done

# STEP 1: Create backup
echo "📦 PASO 1: Creando backup de V3..."
cd backend
npm run db:backup
cd ..

if [ "$BACKUP_ONLY" = true ]; then
    echo ""
    echo "✅ Backup completado. Saliendo."
    exit 0
fi

# STEP 2: Dry run
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🔍 PASO 2: Ejecutando en modo --dry-run..."
    cd backend
    npm run restore:v2-data:dry-run
    cd ..
    echo ""
    echo "✅ Modo seco completado. Revisar salida y ejecutar sin --dry-run cuando esté listo."
    exit 0
fi

# STEP 3: Real restoration
echo ""
echo "⚠️  PASO 2: Ejecutando restauración REAL..."
echo ""
read -p "¿Deseas continuar? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operación cancelada."
    exit 1
fi

cd backend
npm run restore:v2-data
cd ..

# STEP 4: Verification
echo ""
echo "✅ PASO 3: Verificando restauración..."
echo ""
echo "Conteos de tablas en V3:"

docker exec pecod-postgres psql -U pecod -d pecod -c "
SELECT 'users' as table_name, COUNT(*) as row_count FROM users UNION ALL
SELECT 'courses', COUNT(*) FROM courses UNION ALL
SELECT 'topics', COUNT(*) FROM topics UNION ALL
SELECT 'evaluations', COUNT(*) FROM evaluations UNION ALL
SELECT 'questions', COUNT(*) FROM questions UNION ALL
SELECT 'enrollments', COUNT(*) FROM enrollments
ORDER BY row_count DESC;"

echo ""
echo "🎉 Restauración completada exitosamente"
echo "========================================"
echo ""
echo "Próximos pasos:"
echo "1. Ejecutar tests: npm test"
echo "2. Verificar por API:"
echo "   - GET /courses/mine (profesor Franco)"
echo "   - GET /enrollments/my-courses (alumno Esteban)"
echo ""
