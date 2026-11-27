// mask-parts.js - the sub-parts of every Mask Studio element.
// Each part gets its own note + reference-image slot, keyed part:<element>:<part>.
(function(){
  'use strict';
  const P={};

  P['char:mind']=[
    ['hat','The wide vinyl / record hat','assets/ui/hero-mind.png','0% 0%'],
    ['eye','The single lens eye','assets/ui/hero-mind.png','22% 10%'],
    ['torso','Speaker-box body + neon window','assets/ui/hero-mind.png','40% 45%'],
    ['arm-left','Purple coil arm + glove','assets/ui/hero-mind.png','8% 55%'],
    ['arm-right','Coil arm + brass jack tip','assets/ui/hero-mind.png','75% 50%'],
    ['wheel','The monowheel / tire','assets/ui/hero-mind.png','50% 85%'],
    ['glow','Purple aura & punch trail','assets/previews/heroes-crop.png',''],
  ];
  P['char:venture']=[
    ['cap','The black backwards cap','assets/ui/hero-venture.png','0% 0%'],
    ['eye','The single lens eye','assets/ui/hero-venture.png','22% 10%'],
    ['torso','Speaker-box body','assets/ui/hero-venture.png','40% 45%'],
    ['arm-left','Red coil arm','assets/ui/hero-venture.png','8% 55%'],
    ['arm-right','Coil arm + jack','assets/ui/hero-venture.png','75% 50%'],
    ['wheel','The monowheel','assets/ui/hero-venture.png','50% 85%'],
    ['glow','Red aura & trail','assets/previews/heroes-crop.png',''],
  ];
  P['char:brother']=[
    ['silhouette','Brother shape & stance','assets/previews/heroes-crop.png',''],
    ['colors','Hero-mirrored palette','assets/previews/heroes-crop.png',''],
    ['weapon','Fists only (the knife is the lead\'s)','assets/previews/heroes-crop.png',''],
    ['dialogue','Speech balloon lines','assets/previews/heroes-crop.png',''],
  ];
  P['char:tradzkul']=[
    ['meter-face','Twin analog meters','assets/story/story-3.png',''],
    ['body','Rusted metal chassis','assets/story/story-3.png',''],
    ['cables',' trailing cables & hoses','assets/story/story-3.png',''],
    ['signature','The red emblem','assets/story/story-3.png',''],
  ];
  P['char:knowl']=[
    ['trunk','Ancient trunk & roots','assets/story/story-1.png',''],
    ['leaves','Diamond-bright leaves','assets/story/story-1.png',''],
    ['seeds','Floating seed pickups','assets/story/story-1.png',''],
    ['glow','The tree light & chamber','assets/story/story-1.png',''],
  ];

  P['foe:A circle']=[['body','Rolling circle body','assets/enemies/foe-sine-sheet.png',''],['face','Sine wave on its face','assets/enemies/foe-sine-sheet.png',''],['frags','8-way explosion fragments','assets/enemies/foe-sine-sheet.png','']];
  P['foe:B triangle']=[['body','Triangle body','assets/enemies/foe-triangle-sheet.png',''],['face','Slanted brows + dot eyes','assets/enemies/foe-triangle-sheet.png',''],['rope','Rope swing + reel','assets/enemies/foe-triangle-sheet.png',''],['frags','3-corner fragments','assets/enemies/foe-triangle-sheet.png','']];
  P['foe:C square']=[['body','Square body','assets/enemies/foe-square-sheet.png',''],['face','Eyes + box mouth','assets/enemies/foe-square-sheet.png',''],['rope','Rope haul','assets/enemies/foe-square-sheet.png',''],['frags','4-corner fragments','assets/enemies/foe-square-sheet.png','']];
  P['foe:E the eye']=[['lens','The single glowing lens','assets/enemies/foe-noise-sheet.png',''],['body','Red pentagon body','assets/enemies/foe-noise-sheet.png',''],['laser','Telegraphed beam','assets/enemies/foe-noise-sheet.png',''],['shutdown','Grey turned/downed look','assets/enemies/foe-noise-sheet.png','']];
  P['foe:F the cube']=[['faces','Transparent hexagon faces','assets/enemies/foe-jelly-sheet.png',''],['notches','6 notch weak points','assets/enemies/foe-jelly-sheet.png',''],['core','Pull / charge / push core','assets/enemies/foe-jelly-sheet.png',''],['collapse','Collapse reaction','assets/enemies/foe-jelly-sheet.png','']];
  P['foe:HEPTAGON boss']=[['nodes','7 corner beam nodes','assets/enemies/foe-jelly-sheet.png',''],['body','Heptagon body','assets/enemies/foe-jelly-sheet.png',''],['corona','7-beam corona pattern','assets/enemies/foe-jelly-sheet.png',''],['bowl','The stone bowl / seal','assets/enemies/foe-jelly-sheet.png',''],['shutdown','Grey shutdown look','assets/enemies/foe-jelly-sheet.png','']];
  P['foe:signol']=[['body','Signol body','assets/enemies/signol.png',''],['motion','Patrol & attack','assets/enemies/signol.png','']];

  P['lvl:1.1']=[['sky','Dusk swirl sky','assets/levels/awdjoo-beta-preview.png',''],['ground','Grass / soil tiles','assets/tiles/tiles-1-1.png',''],['houses','Houses, roofs, windows','assets/tiles/tiles-1-1.png',''],['props','Fence, palms, hibiscus','assets/tiles/tiles-1-1.png',''],['lighting','Lit windows & glow','assets/levels/awdjoo-beta-preview.png','']];
  P['lvl:1.2']=[['water','Water surface & depth','assets/levels/awdjoo-1-2-preview.png',''],['platforms','Bridges & terrace','assets/levels/awdjoo-1-2-preview.png',''],['sky','Sky band','assets/levels/awdjoo-1-2-preview.png',''],['ambience','Rain / bubbles / bed','assets/levels/awdjoo-1-2-preview.png','']];
  P['lvl:1.3']=[['towers','Three skyscrapers','assets/levels/awdjoo-1-3-preview.png',''],['sky','High sky + drones','assets/levels/awdjoo-1-3-preview.png',''],['facade','Facade windows & neon','assets/levels/awdjoo-1-3-preview.png',''],['boss-arena','The bowl arena','assets/levels/awdjoo-1-3-preview.png','']];

  P['item:TRS LASER CANNON']=[['grip','Black rubber grip','assets/items/mv2-held-jacks-standard-enhanced.png','0% 0%'],['body','Body & rings','assets/items/mv2-held-jacks-standard-enhanced.png','0% 0%'],['tip','Gold tip','assets/items/mv2-held-jacks-standard-enhanced.png','0% 0%'],['charge-glow','Charge glow','assets/items/mv2-held-jacks-standard-enhanced.png','0% 0%']];
  P['item:RCA GRAPPLING HOOK']=[['grip','Purple cable','assets/items/mv2-held-jacks-standard-enhanced.png','0% 33.33%'],['body','Purple plug body','assets/items/mv2-held-jacks-standard-enhanced.png','0% 33.33%'],['tip','Gold RCA tip','assets/items/mv2-held-jacks-standard-enhanced.png','0% 33.33%'],['rope','Rope & latch','assets/items/mv2-held-jacks-standard-enhanced.png','0% 33.33%']];
  P['item:XLR PUSH JACK']=[['grip','Black grip','assets/items/mv2-held-jacks-standard-enhanced.png','0% 66.66%'],['body','Silver connector','assets/items/mv2-held-jacks-standard-enhanced.png','0% 66.66%'],['tip','XLR face','assets/items/mv2-held-jacks-standard-enhanced.png','0% 66.66%'],['air','Air / gust visual','assets/items/mv2-held-jacks-standard-enhanced.png','0% 66.66%']];
  P['item:MEG']=[['horseshoe','Red magnet horseshoe','assets/items/mv2-held-jacks-standard-enhanced.png','0% 100%'],['poles','Silver poles','assets/items/mv2-held-jacks-standard-enhanced.png','0% 100%'],['charge-line','Glowing charge line','assets/items/mv2-held-jacks-standard-enhanced.png','0% 100%']];
  P['item:GAUCHO KNIFE']=[['blade','Damascus kiritsuke blade','assets/story/story-3.png',''],['copper-core','Copper core','assets/story/story-3.png',''],['heat','Heat / pull visual','assets/story/story-3.png',''],['slash','Wide slash arc','assets/story/story-3.png','']];

  P['ui:title']=[['hero-art','Hero illustration','assets/ui/title-home.jpg',''],['type','Title type','assets/ui/title-key.jpg',''],['menu','Menu rows','assets/ui/title-home.jpg',''],['framing','Borders & paper','assets/ui/title-home.jpg','']];
  P['ui:character select']=[['portrait','Hero portrait','assets/ui/hero-mind.png',''],['role-label','Role text','assets/ui/hero-venture.png',''],['mode-cards','Play-mode cards','assets/ui/hero-mind.png','']];
  P['ui:story cards']=[['composition','Page composition','assets/story/story-5.png',''],['palette','Palette','assets/story/story-1.png',''],['caption','Caption type','assets/story/story-3.png','']];

  // Audio cues: every sound breaks into the same four layers so patterns are comparable.
  function audioParts(){ return [
    ['attack','How it starts — sharp / soft / instant'],
    ['body','The main tone or sample texture'],
    ['texture','Noise / FM / layer character'],
    ['decay','How it ends — tail, length, fade'],
  ].map(([n,d])=>[n,d,'','']); }

  window.MASK_PARTS={
    forElement(el){
      if(P[el.k])return P[el.k];
      if(el.t==='sfx')return audioParts();
      return [['main','The whole element',el.art||'',el.crop||'']];
    },
    key(el,part){ return 'part:'+el.k+':'+part; }
  };
})();
