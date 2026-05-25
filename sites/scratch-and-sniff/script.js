(function () {
  var PRODUCTS = [
    { id: 1, name: 'Natural Treat Pack', img: 'images/product-treats.jpg' },
    { id: 2, name: 'Raw Meat Bundle', img: 'images/product-raw.jpg' },
    { id: 3, name: 'Chews & Bones', img: 'images/product-chews.jpg' },
    { id: 4, name: 'Enrichment Toy Set', img: 'images/product-toys.jpg' }
  ];

  // Theme
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');
  var saved = localStorage.getItem('theme');
  if (saved) {
    root.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    root.setAttribute('data-theme', 'light');
  }
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // Reveal
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // Variant selection + price update
  var selectedVariants = {};
  var selectedPrices = {};

  document.querySelectorAll('.variant-btns').forEach(function (group) {
    var pid = group.dataset.product;
    var firstBtn = group.querySelector('.variant-btn');
    if (firstBtn) {
      selectedVariants[pid] = firstBtn.dataset.variant;
      selectedPrices[pid] = parseFloat(firstBtn.dataset.price);
    }
    group.querySelectorAll('.variant-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group.querySelectorAll('.variant-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedVariants[pid] = btn.dataset.variant;
        selectedPrices[pid] = parseFloat(btn.dataset.price);
        var priceEl = document.getElementById('price-' + pid);
        if (priceEl) priceEl.textContent = '$' + parseFloat(btn.dataset.price).toFixed(2);
      });
    });
  });

  // Cart state
  var cart = [];

  function addToCart(pid, variant, price) {
    var product = PRODUCTS.find(function (p) { return p.id === pid; });
    if (!product) return;
    var key = pid + '-' + variant;
    var existing = cart.find(function (i) { return i.key === key; });
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ key: key, pid: pid, name: product.name, img: product.img, variant: variant, price: price, qty: 1 });
    }
    updateCartUI();
    openCart();
  }

  function updateCartUI() {
    var total = cart.reduce(function (acc, i) { return acc + i.qty; }, 0);
    var countEl = document.getElementById('cartCount');
    countEl.textContent = total;
    countEl.style.display = total > 0 ? 'flex' : 'none';
    renderCartItems();
  }

  function renderCartItems() {
    var list = document.getElementById('cartItems');
    if (cart.length === 0) {
      list.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
      document.getElementById('cartTotal').textContent = '$0.00';
      return;
    }
    list.innerHTML = cart.map(function (item) {
      return '<div class="cart-item">' +
        '<img src="' + item.img + '" alt="' + item.name + '" class="cart-item__img" loading="lazy">' +
        '<div class="cart-item__info">' +
          '<div class="cart-item__name">' + item.name + '</div>' +
          '<div class="cart-item__variant">' + item.variant + '</div>' +
          '<div class="cart-item__price">$' + (item.price * item.qty).toFixed(2) + '</div>' +
        '</div>' +
        '<div class="cart-item__qty">' +
          '<button data-key="' + item.key + '" data-delta="1" aria-label="Add one">+</button>' +
          '<span>' + item.qty + '</span>' +
          '<button data-key="' + item.key + '" data-delta="-1" aria-label="Remove one">−</button>' +
        '</div>' +
      '</div>';
    }).join('');
    var total = cart.reduce(function (acc, i) { return acc + i.price * i.qty; }, 0);
    document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);

    list.querySelectorAll('.cart-item__qty button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeQty(btn.dataset.key, parseInt(btn.dataset.delta));
      });
    });
  }

  function changeQty(key, delta) {
    var item = cart.find(function (i) { return i.key === key; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(function (i) { return i.key !== key; });
    updateCartUI();
  }

  // Add to cart buttons
  document.querySelectorAll('.add-to-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pid = parseInt(btn.dataset.id);
      var variant = selectedVariants[pid] || '';
      var price = selectedPrices[pid] || 0;
      addToCart(pid, variant, price);
    });
  });

  // Cart open/close
  function openCart() {
    document.getElementById('cartSidebar').classList.add('is-open');
    document.getElementById('cartOverlay').classList.add('is-open');
  }

  function closeCart() {
    document.getElementById('cartSidebar').classList.remove('is-open');
    document.getElementById('cartOverlay').classList.remove('is-open');
  }

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // Checkout
  document.getElementById('checkoutBtn').addEventListener('click', function () {
    if (cart.length === 0) return;
    closeCart();
    openModal();
  });

  function openModal() {
    var total = cart.reduce(function (acc, i) { return acc + i.price * i.qty; }, 0);
    var body = document.getElementById('modalBody');
    body.innerHTML = cart.map(function (item) {
      return '<div class="modal-item">' +
        '<div class="modal-item__info">' +
          '<span class="modal-item__name">' + item.name + '</span>' +
          '<span class="modal-item__detail">' + item.variant + ' &times; ' + item.qty + '</span>' +
        '</div>' +
        '<span class="modal-item__price">$' + (item.price * item.qty).toFixed(2) + '</span>' +
      '</div>';
    }).join('') +
      '<div class="modal-total"><span>Order Total</span><span>$' + total.toFixed(2) + '</span></div>';

    var foot = document.getElementById('placeOrderBtn');
    foot.style.display = 'flex';
    document.getElementById('checkoutModal').classList.add('is-open');
    document.getElementById('modalOverlay').classList.add('is-open');
  }

  function closeModal() {
    document.getElementById('checkoutModal').classList.remove('is-open');
    document.getElementById('modalOverlay').classList.remove('is-open');
  }

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', closeModal);

  document.getElementById('placeOrderBtn').addEventListener('click', function () {
    document.getElementById('modalBody').innerHTML =
      '<div class="order-success">' +
        '<h3>Order placed!</h3>' +
        '<p>Thanks — we\'ll be in touch shortly to confirm your order and arrange payment.</p>' +
        '<p style="margin-top:12px">Questions? Call us: <a href="tel:+61438063552">+61 438 063 552</a></p>' +
      '</div>';
    document.getElementById('placeOrderBtn').style.display = 'none';
    cart = [];
    updateCartUI();
  });
})();
