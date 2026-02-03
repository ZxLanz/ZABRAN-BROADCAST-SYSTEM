$ascii = @(
    " .d8888b.           d8b          888       8888888888P d8b 888                   ",
    "d88P  Y88b          Y8P          888             d88P  Y8P 888                   ",
    "Y88b.                            888            d88P       888                   ",
    " 'Y888b.    8888b.  888 88888b.  888888        d88P    888 888  8888b.  88888b.  ",
    "    'Y88b.     '88b 888 888 '88b 888          d88P     888 888     '88b 888 '88b ",
    "      '888 .d888888 888 888  888 888         d88P      888 888 .d888888 888  888 ",
    "Y88b  d88P 888  888 888 888  888 Y88b.      d88P       888 888 888  888 888  888 ",
    " 'Y8888P'  'Y888888 888 888  888  'Y888    d8888888888 888 888 'Y888888 888  888 ",
    "",
    "                 [ SYSTEM ONLINE - WELCOME SAINT ZILAN ]",
    ""
)

$colors = @("Green")


foreach ($line in $ascii) {
    if ($line -match "SYSTEM ONLINE") {
        Write-Host $line -ForegroundColor White
    }
    else {
        Write-Host $line -ForegroundColor $colors[0]
    }
}
