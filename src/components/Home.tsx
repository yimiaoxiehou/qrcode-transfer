import * as React from "react";

import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";

const Home = () => {
  return (
    <div>
      <ButtonGroup className="lg">
        <Button href="/send">发送</Button>
      </ButtonGroup>
      <br></br>
      <br></br>
      <ButtonGroup className="lg">
        <Button href="/receive" variant="warning">接收</Button>
      </ButtonGroup>
    </div>
  );
};

export default Home;
