\version "2.24.0"
#(set-global-staff-size 24)
\paper { indent = 0  paper-width = 190\mm  paper-height = 120\mm  top-margin=10\mm bottom-margin=10\mm left-margin=10\mm right-margin=10\mm }
\header { tagline = ##f }
\score { \new Staff { \clef bass \key e \major \time 2/4
  e4 fis4 | gis8 r8 a4 | b4 bis4 \break
  r4 r8 cis'8 | dis'2 | e2 \bar "|." }
  \layout { \context { \Score \remove "Bar_number_engraver" } } }
