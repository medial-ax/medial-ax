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
    padding: 0;
    grid-template-columns: max-content auto minmax(2rem, max-content);
    gap: 0.5rem 1rem;
    justify-items: end;

    input[type="range"]:disabled,
    input[type="range"]:disabled + span,
    p:has(+ input[type="range"]:disabled) {
      opacity: 0.5;
    }
  }

  span.tooltip {
    display: inline-block;
    padding: 2px;
    border-radius: 4px;
    border: 1px solid #888;
    height: 18px;
    box-sizing: border-box;
    vertical-align: super;
    line-height: 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: default;
  }

  .row {
    display: flex;
    gap: 1rem;
  }

  /* Title bar */
  div:has(> h2) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pruning-param-list {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0;
    & > div {
      padding: 0 1rem;
    }
  }

  .predef-files-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;

    border: 1px solid #ddd;
    margin: 0 1rem;
    padding: 0 !important;

    li {
      padding: 0.2rem 0.4rem;
      &:hover {
        background: #f3f3f3;
        cursor: pointer;
      }
    }
  }

  .collapse {
    > h4 {
      padding-left: 2px !important;
      border-bottom: 1px solid #ccc;

      &:hover {
        background: #f3f3f3;
        cursor: pointer;
      }

      &:has(+ [aria-hidden="true"])::before {
        content: "▶︎ ";
      }
      &:has(+ [aria-hidden="false"])::before {
        content: "▼ ";
      }
    }
    > div {
      &[aria-hidden="true"] {
        max-height: 0;
      }
      transition: max-height 0.15s ease-in-out;
      overflow-y: hidden;
    }
  }
`;
