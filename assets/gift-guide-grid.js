/**
 * Gift guide product grid (vanilla JS).
 * Popup from the "+" button (from 1920px a small product card comes first), variant selection,
 * Add to cart, and the add-on rule: a Black + Medium variant also adds the add-on product.
 */
(function () {
  'use strict';

  const OPEN_CLASS = 'is-open';
  const ERROR_CLASS = 'is-error';
  const VISIBLE_CLASS = 'is-visible';
  const LARGE_SCREEN = window.matchMedia('(min-width: 1920px)'); // the 4K design starts here
  const popups = []; // every ProductPopup, so only one product card is open at a time
  const TOAST_DURATION_MS = 5000;
  const MESSAGE_DURATION_MS = 3000; // how long a message in the popup stays, e.g. "Please choose your size"

  /* Cart requests */

  const CartApi = {
    /** Adds the items in one request (all are added, or none). */
    async addItems(items) {
      const response = await fetch(`${window.routes?.cart_add_url || '/cart/add'}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();

      // Shopify answers with status 422 and a "description" when something is wrong
      if (!response.ok) throw new Error(data.description || data.message || '');
      return data;
    },
  };

  /* "Added to cart" notification */

  class CartToast {
    constructor(root) {
      this.root = root;
      this.list = root.querySelector('[data-toast-items]');
      this.timer = null;

      root.querySelector('[data-toast-close]').addEventListener('click', () => this.hide());
    }

    /** items: [{ title, imageSrc, note }] one per added product. note is a small line under the title (optional). */
    show(items) {
      this.list.replaceChildren(...items.map((item) => this.createRow(item)));

      this.root.classList.add(VISIBLE_CLASS);

      // Hide by itself after a few seconds (restart the timer if it shows again)
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.hide(), TOAST_DURATION_MS);
    }

    /** One row: image + title (+ note) */
    createRow({ title, imageSrc, note }) {
      const row = document.createElement('li');
      row.className = 'gift-guide-toast__item';

      if (imageSrc) {
        const image = document.createElement('img');
        image.className = 'gift-guide-toast__image';
        image.src = imageSrc;
        image.alt = '';
        image.width = 64;
        image.height = 75;
        row.append(image);
      }

      const text = document.createElement('div');
      const titleElement = document.createElement('p');
      titleElement.className = 'gift-guide-toast__product';
      titleElement.textContent = title;
      text.append(titleElement);

      if (note) {
        const noteElement = document.createElement('p');
        noteElement.className = 'gift-guide-toast__note';
        noteElement.textContent = note;
        text.append(noteElement);
      }

      row.append(text);
      return row;
    }

    hide() {
      clearTimeout(this.timer);
      this.root.classList.remove(VISIBLE_CLASS);
    }
  }

  /* Custom dropdown (a native <select> can't be styled). Arrows move, Enter / Space select, Escape closes. */

  class CustomSelect {
    /** root: the [data-gift-guide-select] element, onChange: called after a value is picked */
    constructor(root, onChange) {
      this.root = root;
      this.onChange = onChange;
      this.input = root.querySelector('input[type="hidden"]');
      this.trigger = root.querySelector('[data-select-trigger]');
      this.valueLabel = root.querySelector('[data-select-value]');
      this.list = root.querySelector('[data-select-list]');
      this.options = [...this.list.querySelectorAll('[role="option"]')];
      this.placeholder = this.valueLabel.textContent;

      this.trigger.addEventListener('click', () => this.toggle());
      this.trigger.addEventListener('keydown', (event) => this.onTriggerKeydown(event));
      this.list.addEventListener('click', (event) => this.onListClick(event));
      this.list.addEventListener('keydown', (event) => this.onListKeydown(event));

      // Click outside closes the list
      document.addEventListener('pointerdown', (event) => {
        if (!this.root.contains(event.target)) this.close();
      });
    }

    /** Selected value ('' when nothing is selected yet). */
    get value() {
      return this.input.value;
    }

    get position() {
      return Number(this.input.dataset.optionPosition);
    }

    get isOpen() {
      return !this.list.hidden;
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.list.hidden = false;
      this.trigger.setAttribute('aria-expanded', 'true');
      // Move focus to the selected option (or the first enabled one) for keyboard users
      const target = this.options.find((option) => option.getAttribute('aria-selected') === 'true')
        || this.enabledOptions()[0];
      target?.focus();
    }

    close({ returnFocus = false } = {}) {
      this.list.hidden = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) this.trigger.focus();
    }

    enabledOptions() {
      return this.options.filter((option) => option.getAttribute('aria-disabled') !== 'true');
    }

    /** Marks options as available / unavailable (called by ProductPopup). */
    setAvailability(isAvailable) {
      this.options.forEach((option) => {
        const available = isAvailable(option.dataset.value);
        option.toggleAttribute('aria-disabled', !available);
        if (available) option.removeAttribute('aria-disabled');
        else option.setAttribute('aria-disabled', 'true');
      });
    }

    select(option) {
      if (!option || option.getAttribute('aria-disabled') === 'true') return;

      this.options.forEach((item) => item.setAttribute('aria-selected', String(item === option)));
      this.input.value = option.dataset.value;
      this.valueLabel.textContent = option.dataset.value;
      this.root.classList.add('has-value');
      this.close({ returnFocus: true });
      this.onChange();
    }

    onListClick(event) {
      this.select(event.target.closest('[role="option"]'));
    }

    onTriggerKeydown(event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.open();
      }
    }

    onListKeydown(event) {
      const enabled = this.enabledOptions();
      const index = enabled.indexOf(document.activeElement);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          enabled[Math.min(index + 1, enabled.length - 1)]?.focus();
          break;
        case 'ArrowUp':
          event.preventDefault();
          enabled[Math.max(index - 1, 0)]?.focus();
          break;
        case 'Home':
          event.preventDefault();
          enabled[0]?.focus();
          break;
        case 'End':
          event.preventDefault();
          enabled[enabled.length - 1]?.focus();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.select(document.activeElement);
          break;
        case 'Escape':
          // Only close the list, not the whole popup
          event.preventDefault();
          event.stopPropagation();
          this.close({ returnFocus: true });
          break;
        case 'Tab':
          this.close();
          break;
      }
    }
  }

  /* One product popup */

  class ProductPopup {
    /** item: the grid item, config: values read from the section (add-on product, texts, toast) */
    constructor(item, config) {
      this.item = item;
      this.config = config;

      // Elements
      this.openButton = item.querySelector('[data-popup-open]');
      this.card = item.querySelector('[data-popup-card]');
      this.dialog = item.querySelector('[data-popup]');
      this.form = item.querySelector('[data-popup-form]');
      this.closeButton = item.querySelector('[data-popup-close]');
      this.priceElement = item.querySelector('[data-popup-price]');
      this.titleElement = item.querySelector('.gift-guide-popup__title');
      this.imageElement = item.querySelector('.gift-guide-popup__image');
      this.messageElement = item.querySelector('[data-popup-message]');
      this.submitButton = item.querySelector('[data-popup-submit]');

      // Data
      this.productId = Number(item.dataset.productId);
      this.variants = JSON.parse(item.querySelector('[data-popup-variants]').textContent);

      // Option controls: color swatches (radio inputs) and dropdowns
      this.radios = [...this.form.querySelectorAll('input[type="radio"][data-option-position]')];
      this.selects = [...this.form.querySelectorAll('[data-gift-guide-select]')]
        .map((element) => new CustomSelect(element, () => this.onOptionChange()));

      // Position (1, 2, 3) of every option this product has
      this.positions = [...new Set([
        ...this.radios.map((radio) => Number(radio.dataset.optionPosition)),
        ...this.selects.map((select) => select.position),
      ])];

      popups.push(this);
      this.bindEvents();
      this.refreshView();
    }

    bindEvents() {
      // Large screens: the "+" shows / hides the product card. Smaller screens: it opens the popup.
      this.openButton.addEventListener('click', () => {
        if (LARGE_SCREEN.matches) this.toggleCard();
        else this.open();
      });

      // The product card opens the popup
      this.card?.addEventListener('click', () => this.open());

      // Close the card with Escape (a click outside / a smaller screen are handled once for all products, see below)
      this.item.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.hideCard();
      });

      this.closeButton.addEventListener('click', () => this.close());

      // A click on the dialog element itself is a click on the dark backdrop
      this.dialog.addEventListener('click', (event) => {
        if (event.target === this.dialog) this.close();
      });

      this.radios.forEach((radio) => radio.addEventListener('change', () => this.onOptionChange()));
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.addToCart();
      });
    }

    /* Product card (large screens) */

    toggleCard() {
      if (this.card.hidden) this.showCard();
      else this.hideCard();
    }

    showCard() {
      // Only one card at a time
      popups.forEach((popup) => {
        if (popup !== this) popup.hideCard();
      });

      this.card.hidden = false;
      this.openButton.setAttribute('aria-expanded', 'true'); // the "+" turns into an "x" (CSS)
    }

    hideCard() {
      if (!this.card || this.card.hidden) return;

      this.card.hidden = true;
      this.openButton.removeAttribute('aria-expanded');
    }

    /* Open / close */

    open() {
      this.hideCard();
      this.showMessage('');
      this.dialog.showModal();
    }

    close() {
      this.dialog.close();
    }

    /* Variant selection */

    /** Selected value for each option position, e.g. ['Black', 'Medium']. */
    getSelectedOptions() {
      const selected = [];
      this.radios.forEach((radio) => {
        if (radio.checked) selected[Number(radio.dataset.optionPosition) - 1] = radio.value;
      });
      this.selects.forEach((select) => {
        if (select.value) selected[select.position - 1] = select.value;
      });
      return selected;
    }

    /** The variant that matches every selected option, or undefined if one is still missing. */
    findSelectedVariant() {
      const selected = this.getSelectedOptions();
      const allChosen = this.positions.every((position) => selected[position - 1]);
      if (!allChosen) return undefined;

      return this.variants.find((variant) =>
        this.positions.every((position) => variant.options[position - 1] === selected[position - 1]));
    }

    /** Name of the first option the customer has not chosen yet (for the error message). */
    getMissingOptionName() {
      const selected = this.getSelectedOptions();
      const missingPosition = this.positions.find((position) => !selected[position - 1]);
      if (!missingPosition) return '';

      const select = this.selects.find((item) => item.position === missingPosition);
      return select ? select.placeholder.replace(/^choose your /i, '') : '';
    }

    onOptionChange() {
      this.showMessage('');
      this.refreshView();
    }

    /** Moves the black indicator behind the swatches to the selected color (the CSS reads --swatch-index). */
    updateSwatchIndicator() {
      this.item.querySelectorAll('[data-swatches]').forEach((group) => {
        const radios = [...group.querySelectorAll('input[type="radio"]')];
        group.style.setProperty('--swatch-index', Math.max(radios.findIndex((radio) => radio.checked), 0));
      });
    }

    /** Updates price, image and the availability of every swatch / dropdown value. */
    refreshView() {
      this.updateSwatchIndicator();
      const variant = this.findSelectedVariant();

      if (variant) {
        this.priceElement.textContent = variant.price;
        if (variant.image && this.imageElement) this.imageElement.src = variant.image;
      }

      this.refreshAvailability();
    }

    /** A value is unavailable when no in-stock variant has it together with the other chosen options. */
    refreshAvailability() {
      const selected = this.getSelectedOptions();

      const isValueAvailable = (position, value) => {
        const candidate = [...selected];
        candidate[position - 1] = value;

        return this.variants.some((variant) =>
          variant.available
          && this.positions.every((pos) => !candidate[pos - 1] || variant.options[pos - 1] === candidate[pos - 1]));
      };

      this.radios.forEach((radio) => {
        radio.disabled = !isValueAvailable(Number(radio.dataset.optionPosition), radio.value);
      });
      this.selects.forEach((select) => {
        select.setAvailability((value) => isValueAvailable(select.position, value));
      });
    }

    /* Add to cart */

    async addToCart() {
      const { texts } = this.config;
      const variant = this.findSelectedVariant();

      // Validation: every option chosen and the variant in stock
      if (!variant) {
        this.showMessage(`${texts.choose} ${this.getMissingOptionName()}`.trim(), true);
        return;
      }
      if (!variant.available) {
        this.showMessage(texts.soldOut, true);
        return;
      }

      this.setBusy(true);

      try {
        const items = [{ id: variant.id, quantity: 1 }];
        const addAddon = this.shouldAddAddon(variant);
        if (addAddon) items.push({ id: this.config.addonVariantId, quantity: 1 });

        await CartApi.addItems(items);

        // Tell the rest of the page (e.g. a cart icon) that the cart changed
        document.dispatchEvent(new CustomEvent('gift-guide:cart-updated', { detail: { items } }));

        // Close the popup and confirm in the top-right corner
        this.close();
        const toastItems = [
          {
            title: this.titleElement.textContent,
            imageSrc: this.imageElement?.currentSrc || this.imageElement?.src,
          },
        ];
        if (addAddon) {
          toastItems.push({
            title: this.config.addonTitle,
            imageSrc: this.config.addonImageSrc,
            note: texts.addonAdded,
          });
        }
        this.config.toast.show(toastItems);
      } catch (error) {
        this.showMessage(error.message || texts.error, true);
      } finally {
        this.setBusy(false);
      }
    }

    /** Add-on rule: Black + Medium also adds the add-on. Skipped only when the add-on product itself is being added. */
    shouldAddAddon(variant) {
      const { addonVariantId, addonProductId, triggerColor, triggerSize } = this.config;
      if (!addonVariantId || this.productId === addonProductId) return false;

      const values = variant.options.map((option) => option.toLowerCase());
      if (!values.includes(triggerColor) || !values.includes(triggerSize)) return false;

      return true;
    }

    /* UI helpers */

    /** Shows a message above the button. It removes itself after a few seconds. */
    showMessage(text, isError = false) {
      clearTimeout(this.messageTimer);

      this.messageElement.textContent = text;
      this.messageElement.classList.toggle(ERROR_CLASS, isError);

      if (text) {
        this.messageTimer = setTimeout(() => this.showMessage(''), MESSAGE_DURATION_MS);
      }
    }

    setBusy(isBusy) {
      this.submitButton.setAttribute('aria-busy', String(isBusy));
      this.submitButton.disabled = isBusy;
    }
  }

  /* Init */

  /** Creates one ProductPopup per product of a grid section. */
  function initGrid(grid) {
    // Settings come from data attributes set in sections/gift-guide-grid.liquid
    const { dataset } = grid;
    const config = {
      // The notification sits right after the section wrapper
      toast: new CartToast(grid.parentElement.querySelector('[data-gift-guide-toast]')),
      addonVariantId: Number(dataset.addonVariantId) || null,
      addonProductId: Number(dataset.addonProductId) || null,
      addonTitle: dataset.addonProductTitle,
      addonImageSrc: dataset.addonImageSrc,
      triggerColor: dataset.triggerColor,
      triggerSize: dataset.triggerSize,
      texts: {
        addonAdded: dataset.textAddonAdded,
        choose: dataset.textChoose,
        soldOut: dataset.textSoldOut,
        error: dataset.textError,
      },
    };

    grid.querySelectorAll('[data-gift-guide-product]').forEach((item) => {
      // Blocks without a product have no popup
      if (item.querySelector('[data-popup]')) new ProductPopup(item, config);
    });
  }

  document.querySelectorAll('[data-gift-guide-grid]').forEach(initGrid);

  // One listener for all products: a click outside a product, or a smaller screen, closes the open card
  document.addEventListener('click', (event) => {
    popups.forEach((popup) => {
      if (!popup.item.contains(event.target)) popup.hideCard();
    });
  });
  LARGE_SCREEN.addEventListener('change', () => popups.forEach((popup) => popup.hideCard()));

  // Theme editor: re-init a section after it was edited
  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('[data-gift-guide-grid]').forEach(initGrid);
  });
})();
