\version "2.24.0"
#(set-global-staff-size 22)
\paper { indent = 0  paper-width = 200\mm  paper-height = 160\mm  top-margin=8\mm bottom-margin=8\mm left-margin=8\mm right-margin=8\mm }
\header { tagline = ##f }
\score { \new Staff { \clef treble \omit Staff.TimeSignature cis''4 c''4 des''4 d''4 | eis'4 e'4 fes'4 f'4 | gis'4 g'4 aes'4 a'4 | bis'4 b'4 ces''4 c''4 \break cis'4 c'4 des'4 d'4 | fis''4 f''4 ges''4 g''4 | ais'4 a'4 bes'4 b'4 | dis''4 d''4 ees''4 e''4 } \layout { \context { \Score \remove "Bar_number_engraver" } } }
