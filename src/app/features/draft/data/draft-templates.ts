import { DraftRole } from '@features/draft/models/draft.interface';

export interface TemplatePick {
  id: string;
  name: string;
}

export interface DraftTemplate {
  id: string;
  tag: string;
  name: string;
  description: string;
  color: string;
  picks: Record<DraftRole, TemplatePick>;
}

export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: 'dive',
    tag: 'DIVE',
    name: 'Dive Comp',
    description: 'Triple engage — Malphite + Vi + Galio dive the backline while MF follows with R',
    color: '#e84057',
    picks: {
      top:     { id: 'Malphite',    name: 'Malphite'     },
      jungle:  { id: 'Vi',          name: 'Vi'            },
      mid:     { id: 'Galio',       name: 'Galio'         },
      adc:     { id: 'MissFortune', name: 'Miss Fortune'  },
      support: { id: 'Nautilus',    name: 'Nautilus'      },
    },
  },
  {
    id: 'wombo',
    tag: 'WOMBO',
    name: 'Wombo Combo',
    description: 'Amumu R → Karthus global R → Jinx R cleanup. One fight to end the game',
    color: '#a060e0',
    picks: {
      top:     { id: 'Rumble',    name: 'Rumble'     },
      jungle:  { id: 'Amumu',     name: 'Amumu'      },
      mid:     { id: 'Karthus',   name: 'Karthus'    },
      adc:     { id: 'Jinx',      name: 'Jinx'       },
      support: { id: 'Seraphine', name: 'Seraphine'  },
    },
  },
  {
    id: 'poke',
    tag: 'POKE',
    name: 'Poke / Siege',
    description: 'Whittle enemies from range, take objectives when they back to heal',
    color: '#4a9adf',
    picks: {
      top:     { id: 'Jayce',   name: 'Jayce'  },
      jungle:  { id: 'Nidalee', name: 'Nidalee'},
      mid:     { id: 'Hwei',    name: 'Hwei'   },
      adc:     { id: 'Ezreal',  name: 'Ezreal' },
      support: { id: 'Karma',   name: 'Karma'  },
    },
  },
  {
    id: 'protect',
    tag: 'PROTECT',
    name: 'Protect the Carry',
    description: "Shen global ult + Lulu shields — Kog'Maw becomes untouchable at 3 items",
    color: '#0ac8b9',
    picks: {
      top:     { id: 'Shen',   name: 'Shen'     },
      jungle:  { id: 'Ivern',  name: 'Ivern'    },
      mid:     { id: 'Orianna',name: 'Orianna'  },
      adc:     { id: 'KogMaw', name: "Kog'Maw"  },
      support: { id: 'Lulu',   name: 'Lulu'     },
    },
  },
  {
    id: 'pick',
    tag: 'CATCH',
    name: 'Pick / Catch Comp',
    description: 'Blitz hook or Ahri charm → Camille isolates → Evelynn bursts before reaction',
    color: '#f08030',
    picks: {
      top:     { id: 'Camille',    name: 'Camille'    },
      jungle:  { id: 'Evelynn',    name: 'Evelynn'    },
      mid:     { id: 'Ahri',       name: 'Ahri'       },
      adc:     { id: 'Caitlyn',    name: 'Caitlyn'    },
      support: { id: 'Blitzcrank', name: 'Blitzcrank' },
    },
  },
  {
    id: 'split',
    tag: '1-3-1',
    name: 'Splitpush (1-3-1)',
    description: "Fiora splits, TF teleports globally, Hecarim creates 3-lane pressure — can't be everywhere",
    color: '#e0c040',
    picks: {
      top:     { id: 'Fiora',       name: 'Fiora'        },
      jungle:  { id: 'Hecarim',     name: 'Hecarim'      },
      mid:     { id: 'TwistedFate', name: 'Twisted Fate' },
      adc:     { id: 'Xayah',       name: 'Xayah'        },
      support: { id: 'Thresh',      name: 'Thresh'       },
    },
  },
  {
    id: 'early',
    tag: 'SNOWBALL',
    name: 'Early Game Snowball',
    description: 'Renekton + Lee Sin + Zed win lanes by level 6. Convert advantages fast or fall off',
    color: '#e06040',
    picks: {
      top:     { id: 'Renekton', name: 'Renekton' },
      jungle:  { id: 'LeeSin',   name: 'Lee Sin'  },
      mid:     { id: 'Zed',      name: 'Zed'      },
      adc:     { id: 'Draven',   name: 'Draven'   },
      support: { id: 'Leona',    name: 'Leona'    },
    },
  },
  {
    id: 'kite',
    tag: 'DISENGAGE',
    name: 'Anti-Engage / Kite',
    description: "Janna + Lissandra + Ashe perma-slow counter dive comps — they can't reach you",
    color: '#60c0e0',
    picks: {
      top:     { id: 'Gnar',      name: 'Gnar'      },
      jungle:  { id: 'Graves',    name: 'Graves'    },
      mid:     { id: 'Lissandra', name: 'Lissandra' },
      adc:     { id: 'Ashe',      name: 'Ashe'      },
      support: { id: 'Janna',     name: 'Janna'     },
    },
  },
  {
    id: 'scaling',
    tag: 'SCALING',
    name: 'Late Game Scaling',
    description: 'Stall early, outscale everything at 3 items — Kassadin + Kayn + Vayne become unbeatable',
    color: '#a0a0c0',
    picks: {
      top:     { id: 'Nasus',    name: 'Nasus'    },
      jungle:  { id: 'Kayn',     name: 'Kayn'     },
      mid:     { id: 'Kassadin', name: 'Kassadin' },
      adc:     { id: 'Vayne',    name: 'Vayne'    },
      support: { id: 'Soraka',   name: 'Soraka'   },
    },
  },
  {
    id: 'standard',
    tag: 'META',
    name: 'Standard Meta',
    description: "Flexible balanced comp — K'Sante + Viego frontline, Syndra pick potential, Zyra zoning",
    color: '#c89b3c',
    picks: {
      top:     { id: 'KSante', name: "K'Sante" },
      jungle:  { id: 'Viego',  name: 'Viego'   },
      mid:     { id: 'Syndra', name: 'Syndra'  },
      adc:     { id: 'Jhin',   name: 'Jhin'    },
      support: { id: 'Zyra',   name: 'Zyra'    },
    },
  },
];
