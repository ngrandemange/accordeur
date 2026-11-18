\version "2.24.0"
#(set-global-staff-size 24)
\paper { indent = 0  paper-width = 190\mm  paper-height = 120\mm  top-margin=10\mm bottom-margin=10\mm left-margin=10\mm right-margin=10\mm }
\header { tagline = ##f }
\score {
  \new Staff { \clef alto \time 4/4
    c'4 d'4 e'4 f'4 | g'2 a'2 | b'8 c''8 d''8 e''8 f''4 e''4 | c''1 \break
    g4 a4 b4 c'4 | c8 d8 e8 f8 g4 g4 | f''16 e''16 d''16 c''16 b'8 a'8 g'4 | c'1 \bar "|."
  }
  \layout { \context { \Score \remove "Bar_number_engraver" } }
}
