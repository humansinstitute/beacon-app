# User Model API Endpoints Documentation

This document provides a comprehensive guide on interacting with the User model through the API endpoints, including creating, retrieving, and updating user data. The base URL for all endpoints is assumed to be `http://localhost:3256`. Adjust this if your server is running on a different port or domain.

## 1. Create a New User

- **Endpoint**: `POST /api/user`
- **Description**: Creates a new user in the database with the provided data. The `npub` field is required.
- **Example Payload**:
  ```json
  {
    "npub": "npub1testuser1234567890abcdef",
    "name": "Test User",
    "remoteSigner": {
      "inUse": false,
      "npub": null
    },
    "alias": [
      {
        "type": "wa",
        "ref": "61450160732"
      }
    ],
    "beaconBalance": 0
  }
  ```
- **Expected Response**: HTTP 201 Created with the created user object.

## 2. Get User by Npub

- **Endpoint**: `GET /api/user/:id`
- **Description**: Retrieves a user by their unique `npub` identifier.
- **Example Request**: `GET /api/user/npub1testuser1234567890abcdef`
- **Expected Response**: HTTP 200 OK with the user object, or HTTP 404 Not Found if the user does not exist.

## 3. Get User by Alias

- **Endpoint**: `GET /api/user/lookup?type=<type>&ref=<ref>`
- **Description**: Retrieves a user by their alias, specified by type and reference.
- **Example Request**: `GET /api/user/lookup?type=wa&ref=61450160732`
- **Expected Response**: HTTP 200 OK with the user object, or HTTP 404 Not Found if no user matches the alias.

## 4. Update the User's Name

- **Endpoint**: `PATCH /api/user/:id`
- **Description**: Updates the `name` field of a user identified by `npub`. Only the provided field is updated.
- **Example Payload**:
  ```json
  {
    "name": "Updated Test User"
  }
  ```
- **Expected Response**: HTTP 200 OK with the updated user object, or HTTP 404 Not Found if the user does not exist.

## 5. Update a User's Npub

- **Endpoint**: `PATCH /api/user/:id`
- **Description**: Updates the `npub` field of a user. Note that since `npub` is a unique identifier, this operation should be used cautiously as it may affect data integrity or require additional validation in a production environment.
- **Example Payload**:
  ```json
  {
    "npub": "npub1updateduser1234567890abcdef"
  }
  ```
- **Expected Response**: HTTP 200 OK with the updated user object, or HTTP 404 Not Found if the user does not exist.

## 6. Update a User's Remote Signer

- **Endpoint**: `PATCH /api/user/:id`
- **Description**: Updates the `remoteSigner` nested object of a user. The entire nested object can be updated with new values.
- **Example Payload**:
  ```json
  {
    "remoteSigner": {
      "inUse": true,
      "npub": "npub1signer1234567890abcdef"
    }
  }
  ```
- **Expected Response**: HTTP 200 OK with the updated user object, or HTTP 404 Not Found if the user does not exist.

## 7. Update a User's Beacon Balance

- **Endpoint**: `PATCH /api/user/:id`
- **Description**: Updates the `beaconBalance` field of a user to reflect a new balance.
- **Example Payload**:
  ```json
  {
    "beaconBalance": 100
  }
  ```
- **Expected Response**: HTTP 200 OK with the updated user object, or HTTP 404 Not Found if the user does not exist.

## Additional Notes

- All PATCH requests support partial updates, meaning only the fields provided in the payload will be updated, leaving other fields unchanged.
- Ensure the correct `npub` is used in the URL for GET and PATCH requests to target the intended user.
