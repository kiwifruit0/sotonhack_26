from ..controllers.hello_controller import hello

def test_hello():
    response = hello()
    assert response == {"message": "api called"}, (
        "Expected response does not match actual response"
    )


test_hello()
