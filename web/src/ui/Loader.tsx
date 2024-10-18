import styled from "styled-components";

export const Loader = styled.span<{
  $w0: number;
  $w1: number;
}>`
  width: ${(p) => p.$w0}px;
  height: 12px;

  display: block;
  margin: 2px auto;
  position: relative;
  border-radius: 4px;
  color: #bbb;
  background: currentColor;
  box-sizing: border-box;
  animation: animloader 0.6s 0.3s ease infinite alternate;

  &::after,
  &::before {
    content: "";
    box-sizing: border-box;
    width: ${(p) => p.$w0}px;
    height: 12px;
    background: currentColor;
    position: absolute;
    border-radius: 4px;
    top: 0;
    right: 110%;
    animation: animloader 0.6s ease infinite alternate;
  }
  &::after {
    left: 110%;
    right: auto;
    animation-delay: 0.6s;
  }

  @keyframes animloader {
    0% {
      width: ${(p) => p.$w0}px;
    }
    100% {
      width: ${(p) => p.$w1}px;
    }
  }
`;
