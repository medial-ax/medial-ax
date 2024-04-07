import { renderToString } from "react-dom/server";
import { styled } from "styled-components";

const Div = styled.div<{ time: number }>`
  position: absolute;
  top: 10%;
  left: 0;
  right: 0;
  margin-left: auto;
  margin-right: auto;
  width: fit-content;
  max-width: 30rem;

  z-index: 100;
  background: red;
  border-radius: 4px;
  box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);

  h2 {
    padding: 1rem 2rem 0 2rem;
    color: white;
    text-transform: capitalize;
  }

  p {
    padding: 0 2rem 1rem 2rem;
    color: white;
    font-size: 18px;
  }

  &.info {
    background: #205dec;
  }
  &.warn {
    background: #f77b22;
  }
  &.error {
    background: #ec2033;
  }

  .timer {
    height: 4px;
    margin-bottom: 4px;
    background: white;
    animation: countdown ${({ time }) => time}s linear;
    animation-fill-mode: forwards;

    @keyframes countdown {
      0% {
        width: 100%;
      }
      100% {
        width: 0;
      }
    }
  }
`;

const Toast = ({
  severity,
  msg,
  timeout,
}: {
  severity: Severity;
  msg: string;
  timeout: number;
}) => {
  return (
    <Div className={severity} time={timeout}>
      <h2 style={{ textDecoration: "" }}>{severity}</h2>
      <p>{msg}</p>
      <div className="timer" />
    </Div>
  );
};

type Severity = "warn" | "error" | "info";

export const toast = (severity: Severity, msg: string, timeout: number = 5) => {
  const div = document.createElement("div");
  div.innerHTML = renderToString(
    <Toast msg={msg} severity={severity} timeout={timeout} />,
  );
  document.body.appendChild(div);
  setTimeout(() => {
    document.body.removeChild(div);
  }, timeout * 1000);
};
