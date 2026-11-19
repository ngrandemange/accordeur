// Textes de l'interface. Clés absentes en anglais -> repli sur le français.
const I18N = {
  fr: {
    'nav.home':'Accueil','nav.tuner':'Accordeur','nav.metro':'Métronome','nav.settings':'Réglages',
    'tile.tuner.sub':'Alto · Violon · Guitare','tile.metro.sub':'Tempo · Mesure · Tap',
    'mode.alto':'Alto','mode.violon':'Violon','mode.chro':'Chromatique','mode.guit':'Guitare',
    'auto':'Auto','start':'Démarrer','stop':'Stop','stopTone':'■ Stop',
    'play.note':'🔊 Jouer la note','play.x':'🔊 Jouer {0}',
    'gauge.low':'trop bas','gauge.high':'trop haut','target':'cible',
    'cents.ok':'Juste ✓','cents.high':'▼ Trop haut','cents.low':'▲ Trop bas',
    'msg.idle':'Touchez « Démarrer » et autorisez le micro.','msg.play':'Jouez une note…','msg.listening':'Écoute en cours…',
    'msg.paused':'Micro en pause… touchez l’écran.','msg.cut':'Micro coupé. Rechargez la page.',
    'msg.err':'Erreur : {0} — vérifiez l’autorisation du micro dans Réglages > Safari.','msg.nomic':'Micro indisponible (HTTPS requis).',
    'metro.tap':'👆 Tap tempo','metro.sig':'Mesure','metro.sub':'Subdivision','metro.free':'Libre',
    'sub.1':'Noires','sub.2':'Croches','sub.3':'Triolets','sub.4':'Doubles',
    'metro.flash':'Flash écran','metro.sound':'🔊 Son','metro.mute':'🔇 Muet','metro.vol':'Volume du clic',
    'set.title':'Réglages','set.prefs':'Préférences','set.lang':'Langue','set.instr':'Instrument par défaut',
    'set.help':'Aide','set.about':'À propos','set.notes':'Notes de version','set.version':'Version','set.platform':'Plateforme',
    'help.1':'Accordeur : touchez « Démarrer », jouez une corde. L’aiguille indique si la note est trop basse ou trop haute. Touchez une corde pour la forcer, « Auto » pour la détection automatique.',
    'help.2':'Métronome : réglez le tempo (curseur, ± ou Tap), la mesure et les subdivisions, puis « Démarrer ».',
    'help.3':'Tirez la page vers le bas pour la rafraîchir et chercher une mise à jour.',
    'help.4':'Le micro n’est utilisé que dans l’accordeur et rien n’est enregistré ni envoyé.',
    'score.title':'Partition','score.photo':'📷 Photo','score.again':'📷 Nouvelle photo','score.del':'Effacer','score.empty':'Prenez en photo une partition (imprimée, bien éclairée, à plat) : l’app essaie de la lire et peut la jouer. Une seule photo est gardée.',
    'score.busy':'Analyse de la photo…','score.none':'Aucune portée reconnue. Essayez une photo plus nette, plus proche, bien à plat.','score.found':'{0} portée(s), {1} note(s) reconnue(s). Touchez une note pour la corriger.',
    'score.clef':'Clé','score.clef.alto':'Ut (alto)','score.clef.treble':'Sol','score.clef.bass':'Fa','score.key':'Armure','score.tempo':'Tempo','score.zoom':'Zoom',
    'score.step.prep':'Préparation de la photo…','score.step.angle':'Redressement de la page…','score.step.read':'Lecture des portées et des notes…','score.step.zoom':'Nouvelle lecture en haute résolution…','score.step.done':'Terminé','score.rest':'silence','score.detected':'Clé : {0} · armure : {1} · {2} silence(s).','score.nosound':'Pas de son ? Coupez le mode silencieux (interrupteur sur le côté de l’iPhone) et montez le volume.','score.play':'▶ Jouer','score.stop':'■ Stop','score.limits':'Limites : liaisons, nuances, tuplets et changements de clé ou de mesure ne sont pas lus. Vérifiez et corrigez : touchez une note pour la modifier, une zone vide pour ajouter une note.',
    'edit.title':'Note','edit.pitch':'Hauteur','edit.alter':'Altération','edit.dur':'Durée','edit.dot':'Pointée','edit.delete':'Supprimer','edit.close':'Fermer',
    'dur.4':'Ronde','dur.2':'Blanche','dur.1':'Noire','dur.0.5':'Croche','dur.0.25':'Double','nav.score':'Partition','tile.score.sub':'Photo · Lecture',
    'whatsnew':'Nouveautés','ok':'OK','notes.none':'Notes de version indisponibles.','storage':'Vos préférences sont gardées sur cet appareil.',
  },
  en: {
    'nav.home':'Home','nav.tuner':'Tuner','nav.metro':'Metronome','nav.settings':'Settings',
    'tile.tuner.sub':'Viola · Violin · Guitar','tile.metro.sub':'Tempo · Time signature · Tap',
    'mode.alto':'Viola','mode.violon':'Violin','mode.chro':'Chromatic','mode.guit':'Guitar',
    'auto':'Auto','start':'Start','stop':'Stop','stopTone':'■ Stop',
    'play.note':'🔊 Play note','play.x':'🔊 Play {0}',
    'gauge.low':'too low','gauge.high':'too high','target':'target',
    'cents.ok':'In tune ✓','cents.high':'▼ Too high','cents.low':'▲ Too low',
    'msg.idle':'Tap “Start” and allow the microphone.','msg.play':'Play a note…','msg.listening':'Listening…',
    'msg.paused':'Microphone paused… tap the screen.','msg.cut':'Microphone lost. Reload the page.',
    'msg.err':'Error: {0} — check the microphone permission in Settings > Safari.','msg.nomic':'Microphone unavailable (HTTPS required).',
    'metro.tap':'👆 Tap tempo','metro.sig':'Time signature','metro.sub':'Subdivision','metro.free':'Free',
    'sub.1':'Quarters','sub.2':'Eighths','sub.3':'Triplets','sub.4':'Sixteenths',
    'metro.flash':'Screen flash','metro.sound':'🔊 Sound','metro.mute':'🔇 Muted','metro.vol':'Click volume',
    'set.title':'Settings','set.prefs':'Preferences','set.lang':'Language','set.instr':'Default instrument',
    'set.help':'Help','set.about':'About','set.notes':'Release notes','set.version':'Version','set.platform':'Platform',
    'help.1':'Tuner: tap “Start” and play a string. The needle shows whether the note is too low or too high. Tap a string to lock onto it, “Auto” for automatic detection.',
    'help.2':'Metronome: set the tempo (slider, ± or Tap), the time signature and subdivisions, then “Start”.',
    'help.3':'Pull the page down to refresh it and check for an update.',
    'help.4':'The microphone is only used in the tuner; nothing is recorded or sent anywhere.',
    'score.title':'Score','score.photo':'📷 Photo','score.again':'📷 New photo','score.del':'Clear','score.empty':'Take a photo of a printed, well-lit, flat score: the app tries to read it and can play it. Only one photo is kept.',
    'score.busy':'Analysing the photo…','score.none':'No staff found. Try a sharper, closer, flatter photo.','score.found':'{0} staff line(s), {1} note(s) recognised. Tap a note to fix it.',
    'score.clef':'Clef','score.clef.alto':'C (alto)','score.clef.treble':'Treble','score.clef.bass':'Bass','score.key':'Key','score.tempo':'Tempo','score.zoom':'Zoom',
    'score.step.prep':'Preparing the photo…','score.step.angle':'Straightening the page…','score.step.read':'Reading staves and notes…','score.step.zoom':'Re-reading in high resolution…','score.step.done':'Done','score.rest':'rest','score.detected':'Clef: {0} · key: {1} · {2} rest(s).','score.nosound':'No sound? Turn off silent mode (side switch on the iPhone) and turn the volume up.','score.play':'▶ Play','score.stop':'■ Stop','score.limits':'Limits: ties, dynamics, tuplets and clef or time signature changes are not read. Check and fix: tap a note to edit it, an empty area to add a note.',
    'edit.title':'Note','edit.pitch':'Pitch','edit.alter':'Accidental','edit.dur':'Duration','edit.dot':'Dotted','edit.delete':'Delete','edit.close':'Close',
    'dur.4':'Whole','dur.2':'Half','dur.1':'Quarter','dur.0.5':'Eighth','dur.0.25':'Sixteenth','nav.score':'Score','tile.score.sub':'Photo · Playback',
    'whatsnew':'What’s new','ok':'OK','notes.none':'Release notes unavailable.','storage':'Your preferences are kept on this device.',
  },
};
const FR_TO_EN = {Do:'C', 'Ré':'D', Mi:'E', Fa:'F', Sol:'G', La:'A', Si:'B'};
let LANG = 'fr';
function tr(key, ...a) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.fr[key] ?? key;
  a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
// Noms de notes : Do Ré Mi… en français, C D E… en anglais (les altérations sont conservées).
function nn(label) {
  if (LANG !== 'en') return label;
  return label.replace(/^(Do|Ré|Mi|Fa|Sol|La|Si)/, m => FR_TO_EN[m]);
}
if (typeof module !== 'undefined') module.exports = { I18N, tr, nn };
