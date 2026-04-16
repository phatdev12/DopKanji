'use strict'
var KanjivgAnimate = (function () {
    function _0x10b417(_0x30a79a, _0x595534) {
      _0x595534 = typeof _0x595534 !== 'undefined' ? _0x595534 : 500
      this.setOnClick(_0x30a79a, _0x595534)
    }
    return (
      (_0x10b417.prototype.setOnClick = function _0x7a34f(
        _0x199e3d,
        _0x7a21f2
      ) {
        document.querySelector(_0x199e3d).onclick = () => {
          var _0x32bc2c = new KVGAnimator(_0x7a21f2)
          _0x32bc2c.play(document.querySelector('#kanji-svg'))
        }
      }),
      _0x10b417
    )
  })(),
  KVGAnimator = (function () {
    function _0x29e27a(_0x5953dc) {
      this.time = _0x5953dc
    }
    return (
      (_0x29e27a.prototype.play = function _0xf46966(_0x2b2685) {
        if (
          !_0x2b2685 ||
          _0x2b2685.tagName !== 'svg' ||
          _0x2b2685.querySelectorAll('path').length <= 0
        ) {
          return
        }
        this.paths = _0x2b2685.querySelectorAll('path')
        this.numbers = _0x2b2685.querySelectorAll('text')
        this.pathCount = this.paths.length
        this.hideAll()
        this.count = 0
        this.animatePath(this.paths[this.count], this.numbers[this.count])
      }),
      (_0x29e27a.prototype.hideAll = function _0xdf2bb() {
        for (let _0x3ff123 = 0; _0x3ff123 < this.pathCount; _0x3ff123++) {
          this.paths[_0x3ff123].style.display = 'none'
          this.numbers[_0x3ff123] &&
            (this.numbers[_0x3ff123].style.display = 'none')
        }
      }),
      (_0x29e27a.prototype.animatePath = function _0xc81581(
        _0x848a44,
        _0x251ce9
      ) {
        this.length = _0x848a44.getTotalLength()
        _0x848a44.style.display = 'block'
        if (_0x251ce9) {
          _0x251ce9.style.display = 'block'
        }
        _0x848a44.style.transition = _0x848a44.style.WebkitTransition = 'none'
        _0x848a44.style.strokeDasharray = this.length + ' ' + this.length
        _0x848a44.style.strokeDashoffset = this.length
        _0x848a44.getBoundingClientRect()
        this.interval = this.time / this.length
        this.doAnimation(_0x848a44)
      }),
      (_0x29e27a.prototype.doAnimation = function _0x4fde3f(_0x725e51) {
        let _0x292107 = setTimeout(() => {
          this.doAnimation(_0x725e51)
        }, this.interval)
        _0x725e51.style.strokeDashoffset = this.length
        this.length--
        this.length < 0 &&
          (clearInterval(_0x292107),
          this.count++,
          this.count < this.pathCount &&
            this.animatePath(this.paths[this.count], this.numbers[this.count]))
      }),
      _0x29e27a
    )
  })()
new KanjivgAnimate('#animate-button', 500)
document.querySelector('#load-kanji').onclick = function () {
  const _0x3227c4 = document.querySelector('#kanji-input').value.trim()
  if (_0x3227c4.length !== 1) {
    alert('Please enter a single kanji character.')
    return
  }
  const _0x1fa422 = _0x3227c4.codePointAt(0).toString(16).padStart(5, '0'),
    _0x23f91e =
      'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/' +
      _0x1fa422 +
      '.svg'
  fetch(_0x23f91e)
    .then((_0x38c63e) => {
      if (!_0x38c63e.ok) {
        throw new Error('Kanji SVG not found.')
      }
      return _0x38c63e.text()
    })
    .then((_0x5d46c8) => {
      _0x5d46c8 = _0x5d46c8
        .replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, '')
        .replace(/\]\>/g, '')
        .trim()
      document.querySelector('#kanji-svg-container').innerHTML = _0x5d46c8
      document.querySelector('#kanji-svg-container svg').id = 'kanji-svg'
    })
    .catch((_0x2b97dc) => {
      alert('Error loading Kanji SVG: ' + _0x2b97dc.message)
    })
}
function openModal(_0xaaeba8) {
  fetch(_0xaaeba8)
    .then((_0x7c2cc7) => {
      if (!_0x7c2cc7.ok) {
        throw new Error('Network response was not ok')
      }
      return _0x7c2cc7.text()
    })
    .then((_0x9d7f89) => {
      document.getElementById('modal-body').innerHTML = _0x9d7f89
      const _0x3bdb73 = document.getElementById('modal')
      _0x3bdb73.style.display = 'block'
      _0x3bdb73.classList.remove('hide')
      _0x3bdb73.classList.add('show')
    })
    .catch((_0x11bcbd) => {
      document.getElementById('modal-body').innerHTML =
        '<p>Error loading content. Please try again later.</p>'
      const _0x5966d5 = document.getElementById('modal')
      _0x5966d5.style.display = 'block'
      _0x5966d5.classList.remove('hide')
      _0x5966d5.classList.add('show')
    })
}
function closeModal() {
  const _0x3db466 = document.getElementById('modal')
  _0x3db466.classList.remove('show')
  _0x3db466.classList.add('hide')
  setTimeout(() => {
    _0x3db466.style.display = 'none'
    document.getElementById('modal-body').innerHTML = ''
  }, 300)
}
document.getElementById('privacy-link').onclick = function (_0x469ae8) {
  _0x469ae8.preventDefault()
  openModal('privacy-policy.html')
}
document.getElementById('terms-link').onclick = function (_0x257125) {
  _0x257125.preventDefault()
  openModal('terms-of-service.html')
}
window.onclick = function (_0x2a7e5e) {
  _0x2a7e5e.target.classList.contains('modal') && closeModal()
}
