document.addEventListener('DOMContentLoaded', function () {

    // ===== CSRF токен =====
    function getCsrfToken() {
        // Сначала пробуем из мета-тега
        var meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');

        // Потом из скрытого поля формы
        var input = document.querySelector('input[name="_csrf"]');
        if (input) return input.value;

        return '';
    }

    // ===== Mobile menu =====
    var menuBtn = document.getElementById('mobile-menu-btn');
    var mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('active');
            var icon = menuBtn.querySelector('.material-icons-outlined');
            icon.textContent = mobileMenu.classList.contains('active') ? 'close' : 'menu';
        });
    }

    // ===== Обновление бейджа корзины =====
    function updateCartBadge(count) {
        var badge = document.getElementById('cart-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // Получаем актуальный счётчик
    fetch('/cart/count')
        .then(function (r) { return r.json(); })
        .then(function (d) { updateCartBadge(d.count); })
        .catch(function () {});

    // ===== AJAX добавление в корзину =====
    var addBtn = document.querySelector('.add-to-cart-btn');
    if (addBtn) {
        var form = addBtn.closest('form');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();

                // Собираем данные формы включая _csrf
                var formData = new FormData(form);
                var params = new URLSearchParams();
                formData.forEach(function (value, key) {
                    params.append(key, value);
                });

                var orig = addBtn.innerHTML;
                addBtn.innerHTML = '<span class="material-icons-outlined">check</span> Добавлено';
                addBtn.disabled = true;

                fetch('/cart/add', {
                    method: 'POST',
                    body: params,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                    .then(function (r) {
                        if (r.status === 403) {
                            // CSRF истёк — отправляем форму обычным способом
                            form.submit();
                            return null;
                        }
                        return r.json();
                    })
                    .then(function (d) {
                        if (d && d.success) {
                            updateCartBadge(d.cartCount);
                        }
                        setTimeout(function () {
                            addBtn.innerHTML = orig;
                            addBtn.disabled = false;
                        }, 1500);
                    })
                    .catch(function () {
                        addBtn.innerHTML = orig;
                        addBtn.disabled = false;
                        // Фоллбэк — обычная отправка формы
                        form.submit();
                    });
            });
        }
    }

    // ===== Авто-скрытие flash =====
    document.querySelectorAll('.flash').forEach(function (f) {
        setTimeout(function () {
            f.style.transition = 'opacity 0.3s';
            f.style.opacity = '0';
            setTimeout(function () { f.remove(); }, 300);
        }, 5000);
    });
});