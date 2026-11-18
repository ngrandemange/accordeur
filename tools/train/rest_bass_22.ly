\version "2.24.0"
#(set-global-staff-size 22)
\paper { indent = 0  paper-width = 200\mm  paper-height = 160\mm  top-margin=8\mm bottom-margin=8\mm left-margin=8\mm right-margin=8\mm }
\header { tagline = ##f }
\score { \new Staff { \clef bass \omit Staff.TimeSignature c''4 r4 c''4 r8 c''8 | c''4 r8 c''8 r4 c''4 | r16 c''16 r8 c''4 r4 c''4 \break c''4 r4 r8 c''8 c''4 | r8 c''8 r16 c''16 r8 c''4 r4 } \layout { \context { \Score \remove "Bar_number_engraver" } } }
