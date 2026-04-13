const DEFAULT_NPC_PROFILE = Object.freeze({
  height: 4.8,
  footprint: Object.freeze([3.6, 3.6]),
  interactionOffset: 2.45,
  interactionRadius: 4.4,
  colliderRadius: 1.45
});

const BOT_NPC_PROFILE = Object.freeze({
  height: 4.5,
  footprint: Object.freeze([3.2, 3.2]),
  interactionOffset: 2.3,
  interactionRadius: 4.2,
  colliderRadius: 1.35
});

const LARGE_NPC_PROFILE = Object.freeze({
  height: 5.4,
  footprint: Object.freeze([4.4, 4.4]),
  interactionOffset: 2.8,
  interactionRadius: 4.8,
  colliderRadius: 1.65
});

const TALL_NPC_PROFILE = Object.freeze({
  height: 4.9,
  footprint: Object.freeze([3.6, 3.6]),
  interactionOffset: 2.5,
  interactionRadius: 4.4,
  colliderRadius: 1.45
});

function toSnakeCase(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function createMixamoCharacterDefinition({
  id,
  label,
  fileName,
  portraitFileName = `${toSnakeCase(id)}.png`,
  subtitle = 'City Local',
  npcLabel = label,
  npcProfile = DEFAULT_NPC_PROFILE
}) {
  return Object.freeze({
    id,
    label,
    fileName,
    portraitFileName,
    subtitle,
    itemId: `npc_${toSnakeCase(id)}`,
    npcLabel,
    npcProfile: Object.freeze({
      height: npcProfile.height,
      footprint: Object.freeze([...npcProfile.footprint]),
      interactionOffset: npcProfile.interactionOffset,
      interactionRadius: npcProfile.interactionRadius,
      colliderRadius: npcProfile.colliderRadius
    })
  });
}

function createNamedCharacter(id, fileName, subtitle = 'City Local') {
  return createMixamoCharacterDefinition({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    fileName,
    subtitle
  });
}

function createRosterCharacter(token, fileName) {
  return createMixamoCharacterDefinition({
    id: `ch${token}NonPbr`,
    label: `Ch${token}`,
    fileName,
    subtitle: 'Roster Variant',
    npcLabel: `Ch${token} Non-PBR`
  });
}

export const MIXAMO_CHARACTER_DEFINITIONS = Object.freeze([
  createMixamoCharacterDefinition({
    id: 'xBot',
    label: 'X Bot',
    fileName: 'x-bot.fbx',
    subtitle: 'Balanced Rookie',
    npcProfile: BOT_NPC_PROFILE
  }),
  createMixamoCharacterDefinition({
    id: 'brute',
    label: 'Brute',
    fileName: 'brute.fbx',
    subtitle: 'Heavy Hitter',
    npcProfile: LARGE_NPC_PROFILE
  }),
  createMixamoCharacterDefinition({
    id: 'ch18NonPbr',
    label: 'Ch18',
    fileName: 'ch18-non-pbr.fbx',
    subtitle: 'Street Specialist',
    npcLabel: 'Ch18 Non-PBR',
    npcProfile: TALL_NPC_PROFILE
  }),
  createNamedCharacter('roth', 'Roth.fbx'),
  createNamedCharacter('martha', 'Martha.fbx'),
  createNamedCharacter('maynard', 'Maynard.fbx'),
  createRosterCharacter('23', 'Ch23_nonPBR.fbx'),
  createRosterCharacter('16', 'Ch16_nonPBR.fbx'),
  createRosterCharacter('01', 'Ch01_nonPBR.fbx'),
  createRosterCharacter('33', 'Ch33_nonPBR.fbx'),
  createRosterCharacter('02', 'Ch02_nonPBR.fbx'),
  createRosterCharacter('08', 'Ch08_nonPBR.fbx'),
  createMixamoCharacterDefinition({
    id: 'yBot',
    label: 'Y Bot',
    fileName: 'Y Bot.fbx',
    subtitle: 'Animation Standard',
    npcProfile: BOT_NPC_PROFILE
  }),
  createRosterCharacter('20', 'Ch20_nonPBR.fbx'),
  createRosterCharacter('11', 'Ch11_nonPBR.fbx'),
  createNamedCharacter('remy', 'Remy.fbx')
]);
