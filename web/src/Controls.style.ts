import { css } from "styled-components";

export const CSS = css`
  #open-menu-button {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    margin: 0.6rem;
    max-width: 4rem;
    transform: translateX(0);

    &[aria-hidden="true"] {
      transform: translateX(calc(-100% - 1.2rem));
    }
  }

  fieldset.ranges-with-number {
    border: none;
    display: grid;

    grid-template-columns: max-content auto minmax(2rem, max-content);
    gap: 0.5rem 1rem;
    justify-items: end;

    input[type="range"]:disabled,
    input[type="range"]:disabled + span,
    p:has(+ input[type="range"]:disabled) {
      opacity: 0.5;
    }
  }
`;
