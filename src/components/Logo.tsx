import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export function Logo({ linked = true }: { linked?: boolean }) {
  const content = (
    <>
      <span className="logo__mark" aria-hidden="true">
        <Icon name="hat" size={24} />
      </span>
      <span className="logo__text">
        <strong>BlueHats</strong>
        <span>scanner</span>
      </span>
    </>
  );

  if (!linked) return <div className="logo">{content}</div>;
  return (
    <Link to="/" className="logo" aria-label="BlueHats Scanner home">
      {content}
    </Link>
  );
}
