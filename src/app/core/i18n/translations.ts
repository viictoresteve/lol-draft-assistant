export const TRANSLATIONS = {
  en: {
    // Nav
    navDraft: 'Draft',
    navPool: 'My Pool',
    // Draft page
    draftTitle: 'Draft Assistant',
    myRole: 'My role:',
    side: 'Side:',
    blueSide: 'Blue',
    redSide: 'Red',
    reset: 'Reset',
    ally: 'Ally',
    enemy: 'Enemy',
    // Suggestions panel
    aiSuggestions: 'AI Suggestions',
    analyzingDraft: 'Analyzing draft...',
    noSuggestions: 'Pick or ban a champion to get AI suggestions',
    selectRolePrompt: 'Select your role above to get personalized AI suggestions',
    // Champion search
    searchPlaceholder: 'Search champion...',
    champions: 'champions',
    noChampionsFound: 'No champions found',
    // Ban panel
    addBan: 'Add ban',
    banned: 'Banned',
    // Pool page
    poolTitle: 'My Champion Pool',
    poolSubtitle: "Champions you're comfortable playing. The AI marks them with ★ in suggestions.",
    addChampionSection: 'Add Champion',
    myPoolSection: 'My Pool',
    searchToAdd: 'Search champion to add...',
    poolEmpty: 'Your pool is empty',
    poolEmptyHint:
      'Search for champions above to add them. The AI will prioritize pool champions in suggestions.',
    remove: 'Remove',
    add: 'Add',
    // AI instruction
    aiLang: 'Respond in English.',
  },
  es: {
    // Nav
    navDraft: 'Draft',
    navPool: 'Mi Pool',
    // Draft page
    draftTitle: 'Asistente de Draft',
    myRole: 'Mi rol:',
    side: 'Lado:',
    blueSide: 'Azul',
    redSide: 'Rojo',
    reset: 'Reiniciar',
    ally: 'Aliado',
    enemy: 'Rival',
    // Suggestions panel
    aiSuggestions: 'Sugerencias IA',
    analyzingDraft: 'Analizando draft...',
    noSuggestions: 'Elige o banea un campeón para obtener sugerencias',
    selectRolePrompt: 'Selecciona tu rol arriba para obtener sugerencias personalizadas de la IA',
    // Champion search
    searchPlaceholder: 'Buscar campeón...',
    champions: 'campeones',
    noChampionsFound: 'No se encontraron campeones',
    // Ban panel
    addBan: 'Banear',
    banned: 'Baneado',
    // Pool page
    poolTitle: 'Mi Pool de Campeones',
    poolSubtitle: 'Campeones con los que te sientes cómodo. La IA los marca con ★ en las sugerencias.',
    addChampionSection: 'Añadir Campeón',
    myPoolSection: 'Mi Pool',
    searchToAdd: 'Buscar campeón para añadir...',
    poolEmpty: 'Tu pool está vacío',
    poolEmptyHint:
      'Busca campeones arriba para añadirlos. La IA priorizará los campeones de tu pool en las sugerencias.',
    remove: 'Eliminar',
    add: 'Añadir',
    // AI instruction
    aiLang: 'Responde íntegramente en español.',
  },
} as const;

export type Lang = keyof typeof TRANSLATIONS;
export type Translations = (typeof TRANSLATIONS)[Lang];
